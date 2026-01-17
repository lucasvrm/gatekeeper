import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { PrismaClient } from '@prisma/client'
import { nanoid } from 'nanoid'

import { CompletenessChecker } from './checkers/CompletenessChecker.js'
import type { CompletenessResult, MissingField } from './checkers/types.js'
import { ContractMdGenerator } from './generators/ContractMdGenerator.js'
import { PlanJsonGenerator } from './generators/PlanJsonGenerator.js'
import { TaskPromptGenerator } from './generators/TaskPromptGenerator.js'
import { PromptLoader } from './loaders/PromptLoader.js'
import { LLMAdapterManager } from './adapters/LLMAdapterManager.js'
import type { ILLMAdapter } from './adapters/ILLMAdapter.js'
import { ElicitationSessionRepository } from '../repositories/ElicitationSessionRepository.js'
import {
  ChatMessage,
  ElicitationState,
  ManifestFile,
  MessageRole,
  TaskType,
} from './types/elicitor.types.js'

export interface ElicitorSession {
  outputId: string
  detectedType: TaskType
  currentRound: number
  maxRounds: number
}

export interface ElicitorQuestion {
  id?: string
  text: string
  type: 'choice' | 'text' | 'confirm'
  options?: Array<{ label: string; value: string }>
  allowDefault?: boolean
}

export interface ElicitorOutput {
  outputId: string
  contractMd: string
  planJson: object
  planJsonPath: string
  taskPrompt: string
  completenessScore: number
}

const MAX_ROUNDS = 10
const DEFAULT_PROJECT_PATH = process.cwd()
const MAX_HISTORY_MESSAGES = MAX_ROUNDS * 2

export class ElicitorEngine {
  private sessionRepository: ElicitationSessionRepository
  private adapterManager: LLMAdapterManager
  private checker: CompletenessChecker
  private promptLoader: PromptLoader
  private taskPromptGenerator: TaskPromptGenerator
  private contractGenerator: ContractMdGenerator
  private planGenerator: PlanJsonGenerator

  private currentSession: {
    id: string
    outputId: string
    agentId: string
    detectedType: TaskType
    currentRound: number
    maxRounds: number
  } | null = null

  private currentAdapter: ILLMAdapter | null = null
  private conversationHistory: ChatMessage[] = []
  private contractState: ElicitationState | null = null
  private sessionStartTime: number | null = null
  private systemPrompt: string | null = null
  private questionTree: string | null = null
  private defaults: Record<string, unknown> | null = null
  private schema: Record<string, unknown> | null = null
  private lastQuestion: ElicitorQuestion | null = null

  constructor(private prisma: PrismaClient) {
    this.sessionRepository = new ElicitationSessionRepository(prisma)
    this.adapterManager = new LLMAdapterManager(prisma)
    this.checker = new CompletenessChecker()
    this.promptLoader = new PromptLoader()
    this.taskPromptGenerator = new TaskPromptGenerator()
    this.contractGenerator = new ContractMdGenerator()
    this.planGenerator = new PlanJsonGenerator()
  }

  async start(agentId: string, initialPrompt: string): Promise<{ outputId: string; detectedType: TaskType }> {
    this.sessionStartTime = Date.now()
    this.currentAdapter = await this.adapterManager.getAdapter(agentId)

    const detectedType = await this.detectTaskType(initialPrompt)
    this.ensureSupportedTaskType(detectedType)

    await this.loadPrompts(detectedType)

    const outputId = this.generateOutputId()
    const session = await this.sessionRepository.create({
      outputId,
      agentId,
      initialPrompt,
      detectedType,
    })

    this.currentSession = {
      id: session.id,
      outputId: session.outputId,
      agentId,
      detectedType,
      currentRound: session.currentRound,
      maxRounds: session.maxRounds || MAX_ROUNDS,
    }

    this.contractState = {
      type: detectedType,
      _initialPrompt: initialPrompt,
      _defaults: {},
    }

    this.conversationHistory = []
    this.lastQuestion = null

    await this.sessionRepository.addMessage(session.id, {
      role: MessageRole.USER,
      content: initialPrompt,
      round: 0,
    })

    this.conversationHistory.push({ role: MessageRole.USER, content: initialPrompt })

    await this.persistState()

    return {
      outputId: session.outputId,
      detectedType,
    }
  }

  async resume(outputId: string): Promise<ElicitorSession & { completenessScore: number }> {
    const session = await this.sessionRepository.findByOutputId(outputId)
    if (!session) {
      throw new Error(`Session not found: ${outputId}`)
    }

    if (session.status !== 'IN_PROGRESS') {
      throw new Error(`Session not in progress: ${session.status}`)
    }

    const detectedType = session.detectedType as TaskType
    this.ensureSupportedTaskType(detectedType)

    this.currentAdapter = await this.adapterManager.getAdapter(session.agentId)
    await this.loadPrompts(detectedType)

    this.currentSession = {
      id: session.id,
      outputId: session.outputId,
      agentId: session.agentId,
      detectedType,
      currentRound: session.currentRound,
      maxRounds: session.maxRounds || MAX_ROUNDS,
    }

    this.contractState = this.parseState(session.contractState, detectedType, session.initialPrompt)
    this.sessionStartTime = session.startedAt?.getTime?.() ?? Date.now()

    const messages = await this.sessionRepository.getMessages(session.id)
    this.conversationHistory = messages
      .filter((message) => message.role !== MessageRole.SYSTEM)
      .map((message) => ({
        role: this.normalizeRole(message.role),
        content: message.content,
      }))

    const completeness = this.getCompleteness()

    return {
      outputId: session.outputId,
      detectedType,
      currentRound: session.currentRound,
      maxRounds: session.maxRounds || MAX_ROUNDS,
      completenessScore: completeness.completenessScore,
    }
  }

  async getNextQuestion(): Promise<ElicitorQuestion | null> {
    const { state, session, adapter } = this.requireState()

    const completeness = this.getCompleteness()
    if (completeness.canGenerate) {
      return null
    }

    if (session.currentRound >= session.maxRounds) {
      return null
    }

    await this.incrementRound()

    // Antes de fazer perguntas, tentar gerar manifestFiles automaticamente com a LLM
    if (!this.hasManifestFiles(state)) {
      try {
        await this.generateManifestFilesWithLLM(state, session)
      } catch (error) {
        // Se falhar, continuar normalmente e tentar nas próximas rodadas
        console.error('Erro ao gerar manifestFiles com LLM:', error)
      }
    }

    const missingFields = completeness.missingFields
    const prompt = this.buildQuestionPrompt(missingFields, state, session.currentRound)

    const response = await adapter.chat(
      [...this.conversationHistory, { role: MessageRole.USER, content: prompt }],
      this.systemPrompt ?? undefined
    )

    const question = this.parseQuestion(response.content, missingFields)
    this.lastQuestion = question

    await this.sessionRepository.addMessage(session.id, {
      role: MessageRole.ASSISTANT,
      content: question.text,
      round: session.currentRound,
      tokensIn: response.tokensIn,
      tokensOut: response.tokensOut,
      durationMs: response.durationMs,
      questionId: question.id,
    })

    this.conversationHistory.push({ role: MessageRole.ASSISTANT, content: question.text })
    this.trimHistory()

    return question
  }

  async processAnswer(answer: string, isDefault?: boolean): Promise<void> {
    const { state, session } = this.requireState()

    if (!this.lastQuestion) {
      throw new Error('No pending question to answer.')
    }

    const wasDefault = Boolean(isDefault) || answer === '__DEFAULT__'

    await this.sessionRepository.addMessage(session.id, {
      role: MessageRole.USER,
      content: answer,
      round: session.currentRound,
      wasDefault,
      questionId: this.lastQuestion.id,
    })

    this.conversationHistory.push({ role: MessageRole.USER, content: answer })
    this.trimHistory()

    const update = await this.updateContractState(state, this.lastQuestion, answer, wasDefault)
    const sanitized = this.stripManifestFiles(update)
    this.contractState = this.mergeState(state, sanitized)

    if (wasDefault && this.lastQuestion.id) {
      this.markDefault(this.lastQuestion.id)
    }

    this.lastQuestion = null
    await this.persistState()
  }

  getCompleteness(): CompletenessResult {
    const { state, session } = this.requireState()
    const result = this.checker.validate(state, session.detectedType)

    if (!this.hasManifestFiles(state)) {
      return {
        ...result,
        isComplete: false,
        canGenerate: false,
      }
    }

    return result
  }

  async generate(outputDir: string): Promise<ElicitorOutput> {
    const { state, session } = this.requireState()
    const completeness = this.getCompleteness()

    if (!completeness.canGenerate) {
      throw new Error('Contrato incompleto. Nao e possivel gerar o output ainda.')
    }

    const taskPrompt = this.taskPromptGenerator.generate(state, session.detectedType)
    const contractMd = this.contractGenerator.generate(state, session.detectedType)

    const planJson = this.planGenerator.generateWithContext({
      outputId: session.outputId,
      projectPath: DEFAULT_PROJECT_PATH,
      outputDir,
      taskType: session.detectedType,
      state,
    })

    const outputPath = path.join(outputDir, session.outputId)
    await mkdir(outputPath, { recursive: true })

    const planJsonPath = path.join(outputPath, 'plan.json')

    await writeFile(planJsonPath, JSON.stringify(planJson, null, 2))
    await writeFile(path.join(outputPath, 'contract.md'), contractMd)
    await writeFile(path.join(outputPath, 'taskPrompt.md'), taskPrompt)
    await this.saveElicitationLog(outputPath, completeness)

    const totalDurationMs = this.sessionStartTime ? Date.now() - this.sessionStartTime : 0

    await this.sessionRepository.complete(session.id, {
      completenessScore: completeness.completenessScore,
      taskPrompt,
      planJson: JSON.stringify(planJson),
      totalDurationMs,
    })

    return {
      outputId: session.outputId,
      contractMd,
      planJson,
      planJsonPath,
      taskPrompt,
      completenessScore: completeness.completenessScore,
    }
  }

  private async loadPrompts(taskType: TaskType): Promise<void> {
    this.systemPrompt = await this.promptLoader.loadSystemPrompt()
    this.questionTree = await this.promptLoader.loadQuestions(taskType)
    this.defaults = await this.promptLoader.loadDefaults(taskType)
    this.schema = await this.promptLoader.loadSchema(taskType)
  }

  private async detectTaskType(initialPrompt: string): Promise<TaskType> {
    const adapter = this.requireAdapter()
    if (!this.systemPrompt) {
      this.systemPrompt = await this.promptLoader.loadSystemPrompt()
    }
    const prompt = [
      'Classifique a tarefa em um dos tipos a seguir: UI_COMPONENT, API_ENDPOINT, FEATURE, AUTH, DATA, INTEGRATION.',
      'Responda apenas com o nome do tipo, sem texto adicional.',
      `Tarefa: ${initialPrompt}`,
    ].join('\n')

    const response = await adapter.chat(
      [{ role: MessageRole.USER, content: prompt }],
      this.systemPrompt ?? undefined
    )

    const normalized = response.content.trim().toUpperCase()
    const match = Object.values(TaskType).find((type) => normalized.includes(type))

    if (!match) {
      throw new Error(`Tipo de tarefa invalido: ${response.content}`)
    }

    return match as TaskType
  }

  private ensureSupportedTaskType(taskType: TaskType): void {
    const supported = [
      TaskType.UI_COMPONENT,
      TaskType.API_ENDPOINT,
      TaskType.FEATURE,
      TaskType.AUTH,
      TaskType.DATA,
    ]

    if (!supported.includes(taskType)) {
      throw new Error(`Unsupported task type: ${taskType}`)
    }
  }

  private buildQuestionPrompt(
    missingFields: MissingField[],
    state: ElicitationState,
    round: number
  ): string {
    const fields = missingFields.slice(0, 5).map((field) => ({
      name: field.name,
      path: field.path,
      priority: field.priority,
      description: field.description,
      suggestedQuestion: field.suggestedQuestion,
    }))

    return [
      'Voce e o Elicitor. Gere UMA pergunta simples para avancar a elicitation.',
      'Responda somente com JSON no formato:',
      '{"id":"<path>","text":"<pergunta>","type":"choice|text|confirm","options":[{"label":"...","value":"..."}],"allowDefault":true}',
      'Nao inclua opcao "Nao sei" nas options; use allowDefault=true.',
      `TIPO: ${state.type}`,
      `Rodada atual: ${round}`,
      '',
      'ARVORE_DE_PERGUNTAS:',
      this.questionTree ?? '',
      '',
      'ESTADO_ATUAL:',
      JSON.stringify(state, null, 2),
      '',
      'CAMPOS_FALTANTES:',
      JSON.stringify(fields, null, 2),
    ].join('\n')
  }

  private parseQuestion(content: string, missingFields: MissingField[]): ElicitorQuestion {
    const parsed = this.parseJson<Record<string, unknown>>(content)
    const fallbackField = missingFields[0]

    if (!parsed) {
      return {
        id: fallbackField?.path,
        text: content.trim() || fallbackField?.suggestedQuestion || 'Pode detalhar um pouco mais?',
        type: 'text',
        allowDefault: true,
      }
    }

    const id = typeof parsed.id === 'string' ? parsed.id : fallbackField?.path
    const text = typeof parsed.text === 'string' ? parsed.text : fallbackField?.suggestedQuestion
    const typeValue = typeof parsed.type === 'string' ? parsed.type : 'text'
    const type = typeValue === 'choice' || typeValue === 'confirm' ? typeValue : 'text'

    const optionsRaw = Array.isArray(parsed.options) ? parsed.options : []
    const options = optionsRaw
      .map((option) => ({
        label: typeof option?.label === 'string' ? option.label : '',
        value: typeof option?.value === 'string' ? option.value : '',
      }))
      .filter((option) => option.label && option.value)

    const finalType = type === 'choice' && options.length === 0 ? 'text' : type

    return {
      id,
      text: text || 'Pode detalhar um pouco mais?',
      type: finalType,
      options: finalType === 'choice' ? options : undefined,
      allowDefault: parsed.allowDefault !== false,
    }
  }

  private async updateContractState(
    state: ElicitationState,
    question: ElicitorQuestion,
    answer: string,
    useDefault: boolean
  ): Promise<Record<string, unknown>> {
    const adapter = this.requireAdapter()

    const prompt = [
      'Atualize o estado do contrato com base na resposta do usuario.',
      'Regras:',
      '- Retorne apenas JSON (sem markdown).',
      '- Atualize apenas os campos relevantes.',
      '- Preserve os valores existentes quando nao forem alterados.',
      '- Nao crie ou altere manifestFiles.',
      '- Se useDefault=true, use os defaults fornecidos.',
      '',
      `Pergunta: ${question.text}`,
      `QuestionId: ${question.id || ''}`,
      `Resposta: ${answer}`,
      `useDefault: ${useDefault}`,
      '',
      'SCHEMA:',
      JSON.stringify(this.schema ?? {}, null, 2),
      '',
      'DEFAULTS:',
      JSON.stringify(this.defaults ?? {}, null, 2),
      '',
      'ESTADO_ATUAL:',
      JSON.stringify(state, null, 2),
    ].join('\n')

    const response = await adapter.chat(
      [{ role: MessageRole.USER, content: prompt }],
      this.systemPrompt ?? undefined
    )

    const parsed = this.parseJson<Record<string, unknown>>(response.content)

    if (!parsed) {
      throw new Error('LLM returned invalid JSON for contract update.')
    }

    return parsed
  }

  private mergeState(state: ElicitationState, update: Record<string, unknown>): ElicitationState {
    const target = { ...state } as Record<string, unknown>
    this.mergeRecords(target, update)
    return target as unknown as ElicitationState
  }

  private stripManifestFiles(update: Record<string, unknown>): Record<string, unknown> {
    if (!Object.prototype.hasOwnProperty.call(update, 'manifestFiles')) {
      return update
    }

    const rest = { ...update }
    delete rest.manifestFiles
    return rest
  }

  private mergeRecords(target: Record<string, unknown>, update: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(update)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const existing = target[key]
        if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
          this.mergeRecords(existing as Record<string, unknown>, value as Record<string, unknown>)
        } else {
          target[key] = { ...(value as Record<string, unknown>) }
        }
      } else {
        target[key] = value
      }
    }
  }

  private parseManifestFiles(input: string): ManifestFile[] {
    let parsed: unknown

    // Remover markdown code blocks se presentes (```json...```)
    let cleanInput = input.trim()
    if (cleanInput.startsWith('```')) {
      cleanInput = cleanInput.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }

    try {
      parsed = JSON.parse(cleanInput)
    } catch {
      throw new Error('Invalid manifestFiles JSON. Provide a JSON array.')
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('manifestFiles must be a non-empty array.')
    }

    const files: ManifestFile[] = []

    for (const item of parsed) {
      if (!item || typeof item !== 'object') {
        throw new Error('manifestFiles entries must be objects.')
      }

      const record = item as Record<string, unknown>
      const filePath = typeof record.path === 'string' ? record.path.trim() : ''
      const action = typeof record.action === 'string' ? record.action : ''
      const reason = typeof record.reason === 'string' ? record.reason.trim() : undefined

      if (!filePath) {
        throw new Error('manifestFiles entries must include path.')
      }

      if (!this.isValidAction(action)) {
        throw new Error('manifestFiles entries must include action.')
      }

      if (record.reason !== undefined && !reason) {
        throw new Error('manifestFiles entries must not include empty reason values.')
      }

      files.push({
        path: filePath,
        action: action as ManifestFile['action'],
        reason,
      })
    }

    return files
  }

  private isValidAction(action: string): action is ManifestFile['action'] {
    return action === 'CREATE' || action === 'MODIFY' || action === 'DELETE'
  }

  private markDefault(path: string): void {
    if (!this.contractState) return
    if (!this.contractState._defaults) {
      this.contractState._defaults = {}
    }
    this.contractState._defaults[path] = true
  }

  private async generateManifestFilesWithLLM(state: ElicitationState, sessionData: { id: string; detectedType: TaskType; currentRound: number }): Promise<void> {
    const adapter = this.requireAdapter()

    const prompt = [
      'TAREFA: Identifique TODOS os arquivos que serão impactados pela implementação desta tarefa.',
      '',
      `Tipo: ${sessionData.detectedType}`,
      `Descrição: ${state._initialPrompt || 'Não informada'}`,
      '',
      'Informações coletadas:',
      JSON.stringify(state, null, 2),
      '',
      'INSTRUÇÕES:',
      '1. Analise a tarefa e determine quais arquivos serão criados, modificados ou deletados.',
      '2. Seja específico nos nomes de arquivos e caminhos.',
      '3. Para o projeto Gatekeeper:',
      '   - Frontend (React): src/components/, src/lib/, src/pages/',
      '   - Backend API: packages/gatekeeper-api/src/api/, packages/gatekeeper-api/src/repositories/',
      '   - Testes: packages/gatekeeper-api/test/, src/__tests__/',
      '4. Inclua arquivos de teste se apropriado.',
      '5. Use nomes descritivos baseados na funcionalidade.',
      '',
      'FORMATO DE RESPOSTA (apenas JSON puro, sem markdown):',
      '[',
      '  {"path": "caminho/para/arquivo.tsx", "action": "CREATE", "reason": "Descrição clara"},',
      '  {"path": "outro/arquivo.ts", "action": "MODIFY", "reason": "O que será modificado"}',
      ']',
      '',
      'AÇÕES VÁLIDAS: CREATE, MODIFY, DELETE',
      '',
      'Retorne APENAS o array JSON, sem explicações adicionais.',
    ].join('\n')

    const response = await adapter.chat(
      [{ role: MessageRole.USER, content: prompt }],
      this.systemPrompt ?? undefined
    )

    let manifestFiles: ManifestFile[]
    try {
      manifestFiles = this.parseManifestFiles(response.content)
    } catch (error) {
      console.error('Erro ao parsear manifestFiles da LLM:', error)
      throw error
    }

    state.manifestFiles = manifestFiles

    await this.sessionRepository.addMessage(sessionData.id, {
      role: MessageRole.ASSISTANT,
      content: `Arquivos identificados automaticamente: ${JSON.stringify(manifestFiles)}`,
      round: sessionData.currentRound,
      tokensIn: response.tokensIn,
      tokensOut: response.tokensOut,
      durationMs: response.durationMs,
    })

    await this.persistState()
  }

  private hasManifestFiles(state: ElicitationState): boolean {
    return Array.isArray(state.manifestFiles) && state.manifestFiles.length > 0
  }

  private parseState(contractState: string | null, taskType: TaskType, initialPrompt: string): ElicitationState {
    if (!contractState) {
      return { type: taskType, _initialPrompt: initialPrompt, _defaults: {} }
    }

    try {
      const parsed = JSON.parse(contractState) as Record<string, unknown>
      return { type: taskType, _initialPrompt: initialPrompt, _defaults: {}, ...parsed }
    } catch {
      return { type: taskType, _initialPrompt: initialPrompt, _defaults: {} }
    }
  }

  private async persistState(): Promise<void> {
    const { state, session } = this.requireState()
    const completeness = this.getCompleteness()

    await this.sessionRepository.update(session.id, {
      contractState: JSON.stringify(state),
      completenessScore: completeness.completenessScore,
      missingFields: JSON.stringify(completeness.missingFields),
    })
  }

  private generateOutputId(): string {
    const now = new Date()
    const date = [
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('')

    return `${date}-${nanoid(6)}`
  }

  private async saveElicitationLog(outputPath: string, completeness: CompletenessResult): Promise<void> {
    const { state, session } = this.requireState()
    const log = {
      outputId: session.outputId,
      taskType: session.detectedType,
      startedAt: this.sessionStartTime,
      completedAt: Date.now(),
      durationMs: this.sessionStartTime ? Date.now() - this.sessionStartTime : 0,
      completeness,
      state,
      history: this.conversationHistory,
    }

    await writeFile(
      path.join(outputPath, 'elicitation.log.json'),
      JSON.stringify(log, null, 2)
    )
  }

  private async incrementRound(): Promise<void> {
    if (!this.currentSession) {
      throw new Error('ElicitorEngine not initialized.')
    }

    this.currentSession.currentRound += 1

    await this.sessionRepository.update(this.currentSession.id, {
      currentRound: this.currentSession.currentRound,
    })
  }

  private parseJson<T>(content: string): T | null {
    const json = this.extractJson(content)
    if (!json) return null

    try {
      return JSON.parse(json) as T
    } catch {
      return null
    }
  }

  private extractJson(content: string): string | null {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fenced && fenced[1]) {
      return fenced[1].trim()
    }

    const start = content.indexOf('{')
    const end = content.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return content.slice(start, end + 1)
    }

    return null
  }

  private normalizeRole(role: string): MessageRole {
    switch (role) {
      case MessageRole.ASSISTANT:
      case MessageRole.USER:
        return role
      default:
        return MessageRole.USER
    }
  }

  private trimHistory(): void {
    if (this.conversationHistory.length > MAX_HISTORY_MESSAGES) {
      this.conversationHistory = this.conversationHistory.slice(-MAX_HISTORY_MESSAGES)
    }
  }

  private requireAdapter(): ILLMAdapter {
    if (!this.currentAdapter) {
      throw new Error('LLM adapter not initialized.')
    }
    return this.currentAdapter
  }

  private requireState(): {
    state: ElicitationState
    session: {
      id: string
      outputId: string
      agentId: string
      detectedType: TaskType
      currentRound: number
      maxRounds: number
    }
    adapter: ILLMAdapter
  } {
    if (!this.contractState || !this.currentSession) {
      throw new Error('ElicitorEngine not initialized.')
    }

    return {
      state: this.contractState,
      session: this.currentSession,
      adapter: this.requireAdapter(),
    }
  }
}
