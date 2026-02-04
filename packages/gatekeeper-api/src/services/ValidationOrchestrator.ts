import { existsSync, mkdirSync, copyFileSync, readFileSync, readdirSync } from 'node:fs'
import { join, dirname, basename, isAbsolute, relative, resolve } from 'node:path'
import PQueue from 'p-queue'
import { prisma } from '../db/client.js'
import { GATES_CONFIG, CONTRACT_GATE_NUMBERS, EXECUTION_GATE_NUMBERS } from '../config/gates.config.js'
import type { ValidationContext, GateDefinition, ManifestInput, ContractInput, UIContracts, UIRegistryContract, LayoutContract, OrquiLock } from '../types/index.js'
import { GitService } from './GitService.js'
import { ASTService } from './ASTService.js'
import { TestRunnerService } from './TestRunnerService.js'
import { CompilerService } from './CompilerService.js'
import { LintService } from './LintService.js'
import { BuildService } from './BuildService.js'
import { TokenCounterService } from './TokenCounterService.js'
import { LogService } from './LogService.js'
import { ValidationRunRepository } from '../repositories/ValidationRunRepository.js'
import { GateResultRepository } from '../repositories/GateResultRepository.js'
import { ValidatorResultRepository } from '../repositories/ValidatorResultRepository.js'
import { RunEventService } from './RunEventService.js'
import type { ValidationRun } from '@prisma/client'

export class ValidationOrchestrator {
  private queue: PQueue
  private runRepository: ValidationRunRepository
  private gateRepository: GateResultRepository
  private validatorRepository: ValidatorResultRepository

  constructor() {
    this.queue = new PQueue({ concurrency: 1 })
    this.runRepository = new ValidationRunRepository()
    this.gateRepository = new GateResultRepository()
    this.validatorRepository = new ValidatorResultRepository()
  }

  private async ensureSpecAtCorrectPath(run: ValidationRun): Promise<void> {
    // Parse manifest to get testFile
    if (!run.manifestJson) {
      console.warn('[ensureSpecAtCorrectPath] No manifest found, skipping spec copy')
      return
    }

    let manifest: { testFile?: string } | null = null
    try {
      manifest = JSON.parse(run.manifestJson)
    } catch (error) {
      console.warn('[ensureSpecAtCorrectPath] Failed to parse manifest JSON:', error)
      return
    }

    if (!manifest?.testFile) {
      console.warn('[ensureSpecAtCorrectPath] No testFile in manifest, skipping spec copy')
      return
    }

    if (isAbsolute(manifest.testFile)) {
      throw new Error('manifest.testFile must be a relative path inside the project root.')
    }

    const resolvedTestPath = resolve(run.projectPath, manifest.testFile)
    const relativeToProject = relative(run.projectPath, resolvedTestPath)
    if (relativeToProject.startsWith('..') || isAbsolute(relativeToProject)) {
      throw new Error('manifest.testFile must not escape the project root.')
    }

    // Build target path = projectPath + manifest.testFile
    const targetPath = join(run.projectPath, manifest.testFile)
    const targetExists = existsSync(targetPath)

    let artifactsDir = 'artifacts'
    if (run.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: run.projectId },
        include: { workspace: true },
      })
      if (project?.workspace?.artifactsDir) {
        artifactsDir = project.workspace.artifactsDir
      }
    }

    // Build artifacts path = projectPath/<artifactsDir>/outputId/specFileName
    const specFileName = basename(manifest.testFile)
    const artifactsPath = join(run.projectPath, artifactsDir, run.outputId, specFileName)
    const artifactsExists = existsSync(artifactsPath)

    // Also try the full relative path inside the output dir (Claude Code may nest files)
    const artifactsNestedPath = join(run.projectPath, artifactsDir, run.outputId, manifest.testFile)
    const artifactsNestedExists = !artifactsExists && artifactsNestedPath !== artifactsPath && existsSync(artifactsNestedPath)

    console.log('[ensureSpecAtCorrectPath] Spec lookup:', {
      manifestTestFile: manifest.testFile,
      specFileName,
      artifactsDir,
      artifactsPath,
      artifactsExists,
      artifactsNestedPath: artifactsNestedPath !== artifactsPath ? artifactsNestedPath : '(same)',
      artifactsNestedExists,
      targetPath,
      targetExists,
    })

    if (artifactsExists) {
      const targetDir = dirname(targetPath)
      mkdirSync(targetDir, { recursive: true })
      copyFileSync(artifactsPath, targetPath)
      console.log('[ensureSpecAtCorrectPath] ✅ Copied spec from', artifactsPath, 'to', targetPath)
    } else if (artifactsNestedExists) {
      const targetDir = dirname(targetPath)
      mkdirSync(targetDir, { recursive: true })
      copyFileSync(artifactsNestedPath, targetPath)
      console.log('[ensureSpecAtCorrectPath] ✅ Copied spec from nested path', artifactsNestedPath, 'to', targetPath)
    } else if (targetExists) {
      console.warn('[ensureSpecAtCorrectPath] ⚠️ Spec NOT found in artifacts dir but EXISTS at target — using existing file (possibly stale!)')
      console.warn('[ensureSpecAtCorrectPath] ⚠️ Expected at:', artifactsPath)
      // List what's actually in the artifacts folder for debugging
      try {
        const outputDir = join(run.projectPath, artifactsDir, run.outputId)
        if (existsSync(outputDir)) {
          const entries = readdirSync(outputDir) as string[]
          console.warn('[ensureSpecAtCorrectPath] ⚠️ Artifacts dir contents:', entries)
        } else {
          console.warn('[ensureSpecAtCorrectPath] ⚠️ Artifacts dir does not exist:', outputDir)
        }
      } catch (err) { console.debug('[ValidationOrchestrator] ensureSpecAtCorrectPath:', (err as Error).message) }
    } else {
      throw new Error(
        `Spec file not found in artifacts staging path: ${artifactsPath}. Ensure the artifacts folder is selected.`,
      )
    }

    // Update testFilePath in DB with normalized path (forward slashes)
    const normalizedPath = targetPath.replace(/\\/g, '/')
    await prisma.validationRun.update({
      where: { id: run.id },
      data: { testFilePath: normalizedPath },
    })
    console.log('[ensureSpecAtCorrectPath] ✅ Updated testFilePath in DB:', normalizedPath)
  }

  async executeRun(runId: string): Promise<void> {
    console.log('>>> executeRun CALLED with runId:', runId)
    const run = await this.runRepository.findById(runId)
    if (!run) {
      throw new Error(`Run ${runId} not found`)
    }

    console.log(`[executeRun] Run projectPath: ${run.projectPath}`)
    console.log(`[executeRun] Run testFilePath: ${run.testFilePath}`)

    // Ensure spec is at correct path before changing status
    await this.ensureSpecAtCorrectPath(run)

    // Re-fetch run to get updated testFilePath
    const updatedRun = await this.runRepository.findById(runId)
    if (!updatedRun) {
      throw new Error(`Run ${runId} not found after ensureSpecAtCorrectPath`)
    }

    await this.runRepository.update(runId, {
      status: 'RUNNING',
      startedAt: new Date(),
    })
    RunEventService.emitRunStatus(runId, 'RUNNING')

    const ctx = await this.buildContext(updatedRun)

    const allowedGates = run.runType === 'EXECUTION'
      ? EXECUTION_GATE_NUMBERS
      : CONTRACT_GATE_NUMBERS
    const gatesToRun = GATES_CONFIG.filter(g => allowedGates.includes(g.number))

    for (const gate of gatesToRun) {
      await this.runRepository.update(runId, {
        currentGate: gate.number,
      })

      const gateResult = await this.executeGate(runId, gate, ctx)

      if (!gateResult.passed) {
        await this.runRepository.update(runId, {
          status: 'FAILED',
          passed: false,
          failedAt: gate.number,
          failedValidatorCode: gateResult.failedValidatorCode || null,
          completedAt: new Date(),
        })
        RunEventService.emitRunStatus(runId, 'FAILED', {
          failedAt: gate.number,
          failedValidatorCode: gateResult.failedValidatorCode || null,
        })
        return
      }
    }

    await this.runRepository.update(runId, {
      status: 'PASSED',
      passed: true,
      completedAt: new Date(),
    })
    RunEventService.emitRunStatus(runId, 'PASSED')
  }

  private async executeGate(
    runId: string,
    gate: GateDefinition,
    ctx: ValidationContext
  ): Promise<{ passed: boolean; failedValidatorCode: string | null }> {
    const gateResult = await this.gateRepository.create({
      run: { connect: { id: runId } },
      gateNumber: gate.number,
      gateName: gate.name,
      status: 'RUNNING',
      startedAt: new Date(),
      totalValidators: gate.validators.length,
    })

    // Load failMode configs for all validators
    const validatorKeys = gate.validators.map(v => v.code)
    const configs = await prisma.validationConfig.findMany({
      where: { key: { in: validatorKeys }, category: 'VALIDATOR' },
      select: { key: true, failMode: true }
    })
    const failModeMap = new Map<string, string | null>(
      configs.map(c => [c.key, c.failMode])
    )

    // Helper to determine effective isHardBlock based on failMode config
    const getEffectiveIsHardBlock = (validatorCode: string, defaultIsHardBlock: boolean): boolean => {
      const failMode = failModeMap.get(validatorCode)
      if (failMode === 'WARNING') return false
      if (failMode === 'HARD') return true
      return defaultIsHardBlock // fallback to validator definition
    }

    let passedCount = 0
    let failedCount = 0
    let warningCount = 0
    let skippedCount = 0
    let gatePassed = true
    let failedValidatorCode: string | null = null

    for (const validator of gate.validators) {
      const startTime = Date.now()
      const isBypassed = ctx.bypassedValidators.has(validator.code)
      const effectiveIsHardBlock = getEffectiveIsHardBlock(validator.code, validator.isHardBlock)

      if (isBypassed) {
        const duration = Date.now() - startTime

        await this.validatorRepository.create({
          run: { connect: { id: runId } },
          gateNumber: gate.number,
          validatorCode: validator.code,
          validatorName: validator.name,
          validatorOrder: validator.order,
          status: 'SKIPPED',
          passed: true,
          isHardBlock: effectiveIsHardBlock,
          message: 'Validator bypassed by user',
          startedAt: new Date(startTime),
          completedAt: new Date(),
          durationMs: duration,
          bypassed: true,
        })
        RunEventService.emitValidatorComplete(runId, gate.number, validator.code, 'SKIPPED', true)
        skippedCount++
        continue
      }

      try {
        const isActive = ctx.config.get(validator.code)
        if (isActive === 'false') {
          const duration = Date.now() - startTime
          await this.validatorRepository.create({
            run: { connect: { id: runId } },
            gateNumber: gate.number,
            validatorCode: validator.code,
            validatorName: validator.name,
            validatorOrder: validator.order,
            status: 'SKIPPED',
            passed: true,
            isHardBlock: effectiveIsHardBlock,
            message: 'Validator disabled',
            startedAt: new Date(startTime),
            completedAt: new Date(),
            durationMs: duration,
          })
          RunEventService.emitValidatorComplete(runId, gate.number, validator.code, 'SKIPPED', true)
          skippedCount++
          continue
        }

        const result = await validator.execute(ctx)
        const duration = Date.now() - startTime
        const mergedDetails = result.details ? { ...result.details } : {}
        if (result.context) {
          mergedDetails.context = result.context
        }
        const detailsJson = Object.keys(mergedDetails).length > 0 ? JSON.stringify(mergedDetails) : null

        await this.validatorRepository.create({
          run: { connect: { id: runId } },
          gateNumber: gate.number,
          validatorCode: validator.code,
          validatorName: validator.name,
          validatorOrder: validator.order,
          status: result.status,
          passed: result.passed,
          isHardBlock: effectiveIsHardBlock,
          message: result.message,
          details: detailsJson,
          evidence: result.evidence || null,
          metrics: result.metrics ? JSON.stringify(result.metrics) : null,
          startedAt: new Date(startTime),
          completedAt: new Date(),
          durationMs: duration,
        })
        RunEventService.emitValidatorComplete(runId, gate.number, validator.code, result.status, result.passed)

        switch (result.status) {
          case 'PASSED':
            passedCount++
            break
          case 'FAILED':
            failedCount++
            if (effectiveIsHardBlock) {
              gatePassed = false
              if (!failedValidatorCode) {
                failedValidatorCode = validator.code
              }
            }
            break
          case 'WARNING':
            warningCount++
            break
          case 'SKIPPED':
            skippedCount++
            break
        }

        if (!gatePassed && effectiveIsHardBlock) {
          break
        }
      } catch (error) {
        const duration = Date.now() - startTime

        await this.validatorRepository.create({
          run: { connect: { id: runId } },
          gateNumber: gate.number,
          validatorCode: validator.code,
          validatorName: validator.name,
          validatorOrder: validator.order,
          status: 'FAILED',
          passed: false,
          isHardBlock: effectiveIsHardBlock,
          message: `Validator execution error: ${error instanceof Error ? error.message : String(error)}`,
          durationMs: duration,
        })
        RunEventService.emitValidatorComplete(runId, gate.number, validator.code, 'FAILED', false)

        failedCount++
        if (effectiveIsHardBlock) {
          gatePassed = false
          if (!failedValidatorCode) {
            failedValidatorCode = validator.code
          }
          break
        }
      }
    }

    const completedAt = new Date()
    const durationMs = completedAt.getTime() - (gateResult.startedAt?.getTime() || 0)

    await this.gateRepository.update(gateResult.id, {
      status: gatePassed ? 'PASSED' : 'FAILED',
      passed: gatePassed,
      passedCount,
      failedCount,
      warningCount,
      skippedCount,
      completedAt,
      durationMs,
    })
    RunEventService.emitGateComplete(runId, gate.number, gatePassed, gate.name)

    return { passed: gatePassed, failedValidatorCode }
  }

  private async buildContext(run: ValidationRun): Promise<ValidationContext> {
    const config = await prisma.validationConfig.findMany()
    const configMap = new Map<string, string>()
    
    for (const item of config) {
      const value = item.value
      
      if (item.type === 'NUMBER') {
        const parsed = parseFloat(item.value)
        if (isNaN(parsed)) {
          console.warn(`Invalid number config for ${item.key}: ${item.value}, using as string`)
        }
      } else if (item.type === 'BOOLEAN') {
        if (item.value !== 'true' && item.value !== 'false') {
          console.warn(`Invalid boolean config for ${item.key}: ${item.value}, using as string`)
        }
      }
      
      configMap.set(item.key, value)
    }

    const sensitivePatterns = (
      await prisma.sensitiveFileRule.findMany({
        where: { isActive: true },
      })
    ).map((rule) => rule.pattern)

    const ambiguousTerms = (
      await prisma.ambiguousTerm.findMany({
        where: { isActive: true },
      })
    ).map((term) => term.term)

    let manifest: ManifestInput | null = null
    if (run.manifestJson) {
      try {
        manifest = JSON.parse(run.manifestJson)
      } catch (error) {
        console.error('Failed to parse manifest JSON:', error)
      }
    }

    let contract: ContractInput | null = null
    if (run.contractJson) {
      try {
        contract = JSON.parse(run.contractJson) as ContractInput
      } catch (error) {
        console.error('Failed to parse contract JSON:', error)
      }
    }

    let bypassedValidators = new Set<string>()
    if (run.bypassedValidators) {
      try {
        const parsed = JSON.parse(run.bypassedValidators)
        if (Array.isArray(parsed)) {
          bypassedValidators = new Set(parsed.filter((item) => typeof item === 'string'))
        }
      } catch (error) {
        console.error('Failed to parse bypassed validators JSON:', error)
      }
    }

    const gitService = new GitService(run.projectPath)
    const astService = new ASTService()
    const testRunnerService = new TestRunnerService(run.projectPath, {
      timeout: configMap.has('TEST_EXECUTION_TIMEOUT_MS')
        ? parseInt(configMap.get('TEST_EXECUTION_TIMEOUT_MS')!)
        : undefined,
    })
    const compilerService = new CompilerService(run.projectPath, {
      timeout: configMap.has('COMPILATION_TIMEOUT_MS')
        ? parseInt(configMap.get('COMPILATION_TIMEOUT_MS')!)
        : undefined,
    })
    const lintService = new LintService(run.projectPath, {
      timeout: configMap.has('LINT_TIMEOUT_MS')
        ? parseInt(configMap.get('LINT_TIMEOUT_MS')!)
        : undefined,
    })
    const buildService = new BuildService(run.projectPath, {
      timeout: configMap.has('BUILD_TIMEOUT_MS')
        ? parseInt(configMap.get('BUILD_TIMEOUT_MS')!)
        : undefined,
    })
    const tokenCounterService = new TokenCounterService()
    const logService = new LogService(run.id)

    // Load UI contracts from Orqui
    let uiContracts: UIContracts | null = null
    const uiContractsDir = configMap.get('UI_CONTRACTS_DIR') || join(run.projectPath, 'contracts')
    const lockFileName = 'orqui.lock' + '.json'
    const lockFilePath = join(uiContractsDir, lockFileName)

    // Check if UI lock file existsSync orqui.lock.json - try/catch handles parse errors
    if (existsSync(lockFilePath)) {
      let lock: OrquiLock | null = null
      let registry: UIRegistryContract | null = null
      let layout: LayoutContract | null = null

      try {
        const lockContent = readFileSync(lockFilePath, 'utf-8')
        lock = JSON.parse(lockContent) as OrquiLock
      } catch (error) {
        console.warn('[buildContext] Failed to parse UI contract lock file:', error)
        lock = null
      }

      try {
        const registryPath = join(uiContractsDir, 'ui-registry-contract.json')
        if (existsSync(registryPath)) {
          const registryContent = readFileSync(registryPath, 'utf-8')
          registry = JSON.parse(registryContent) as UIRegistryContract
        }
      } catch (error) {
        console.warn('[buildContext] Failed to parse ui-registry-contract.json:', error)
        registry = null
      }

      try {
        const layoutPath = join(uiContractsDir, 'layout-contract.json')
        if (existsSync(layoutPath)) {
          const layoutContent = readFileSync(layoutPath, 'utf-8')
          layout = JSON.parse(layoutContent) as LayoutContract
        }
      } catch (error) {
        console.warn('[buildContext] Failed to parse layout-contract.json:', error)
        layout = null
      }

      uiContracts = { registry, layout, lock }
    }

    return {
      runId: run.id,
      projectPath: run.projectPath,
      baseRef: run.baseRef,
      targetRef: run.targetRef,
      taskPrompt: run.taskPrompt,
      manifest,
      contract,
      testFilePath: run.testFilePath,
      dangerMode: run.dangerMode,
      services: {
        git: gitService,
        ast: astService,
        testRunner: testRunnerService,
        compiler: compilerService,
        lint: lintService,
        build: buildService,
        tokenCounter: tokenCounterService,
        log: logService,
      },
      config: configMap,
      sensitivePatterns,
      ambiguousTerms,
      bypassedValidators,
      uiContracts,
    }
  }

  addToQueue(runId: string): Promise<void> {
    return this.queue.add(() => this.executeRun(runId))
  }
}
