import { Command } from 'commander'
import inquirer from 'inquirer'
import ora from 'ora'
import chalk from 'chalk'
import boxen from 'boxen'
import { PrismaClient } from '@prisma/client'

import { ElicitorEngine } from '../../elicitor/ElicitorEngine.js'
import { LLMAgentRepository } from '../../repositories/LLMAgentRepository.js'
import { displayContract, displayError } from '../ui/display.js'
import { askQuestion, type LLMQuestion } from '../ui/prompts.js'

const prisma = new PrismaClient()

export const elicitCommand = new Command('elicit')
  .description('Iniciar nova sessão de elicitação de requisitos')
  .option('-a, --agent <slug>', 'Usar agente específico (slug)')
  .option('-t, --task <description>', 'Descrição da tarefa (pula prompt inicial)')
  .option('-o, --output <dir>', 'Diretório de output', 'artifacts')
  .option('--no-validate', 'Não executar Gatekeeper após gerar')
  .action(async (options) => {
    console.log(boxen(
      chalk.bold('Gatekeeper Elicitor'),
      { padding: 1, borderColor: 'cyan', borderStyle: 'round' }
    ))

    try {
      const agentId = await selectAgent(options.agent)
      if (!agentId) return

      const taskDescription = await getTaskDescription(options.task)
      if (!taskDescription) return

      const result = await runElicitation(agentId, taskDescription, options.output)
      if (!result) return

      const approved = await validateWithUser(result.contractMd)
      if (!approved) {
        console.log(chalk.yellow('\nElicitação cancelada pelo usuário.'))
        return
      }

      await saveOutputFiles(result, options.output)

      if (options.validate) {
        await runGatekeeper(result.planJsonPath)
      }

      console.log(chalk.green('\nElicitação concluída com sucesso!'))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      displayError(`Erro durante elicitation: ${message}`)
      process.exit(1)
    } finally {
      await prisma.$disconnect()
    }
  })

async function selectAgent(preselectedSlug?: string): Promise<string | null> {
  const repository = new LLMAgentRepository(prisma)

  if (preselectedSlug) {
    const agent = await repository.findBySlug(preselectedSlug)
    if (!agent) {
      console.error(chalk.red(`Agente não encontrado: ${preselectedSlug}`))
      return null
    }
    if (!agent.isActive) {
      console.error(chalk.red(`Agente desativado: ${preselectedSlug}`))
      return null
    }
    console.log(chalk.dim(`Usando agente: ${agent.name}`))
    return agent.id
  }

  const agents = await repository.findActive()

  if (agents.length === 0) {
    console.error(chalk.red('\nNenhum agente LLM configurado!'))
    console.log(chalk.yellow('Configure agentes em: http://localhost:5173/config/agents'))
    console.log(chalk.dim('Ou via CLI: npx gatekeeper agents add'))
    return null
  }

  const { agentId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'agentId',
      message: 'Selecione o agente LLM:',
      choices: agents.map((agent) => ({
        name: `${agent.name} ${chalk.dim(`(${agent.provider}/${agent.model})`)}${agent.isDefault ? chalk.green(' ★') : ''}`,
        value: agent.id,
      })),
      default: agents.find((agent) => agent.isDefault)?.id,
    },
  ])

  return agentId
}

async function getTaskDescription(presetTask?: string): Promise<string | null> {
  if (presetTask) {
    console.log(chalk.dim(`Tarefa: ${presetTask}`))
    return presetTask
  }

  const { task } = await inquirer.prompt([
    {
      type: 'input',
      name: 'task',
      message: 'Descreva o que você quer fazer:',
      validate: (input) => {
        if (!input.trim()) return 'Por favor, descreva a tarefa.'
        if (input.length < 10) return 'Descreva com mais detalhes (mínimo 10 caracteres).'
        return true
      },
    },
  ])

  return task.trim()
}

interface ElicitationResult {
  outputId: string
  contractMd: string
  planJson: object
  planJsonPath: string
  taskPrompt: string
  completenessScore: number
}

async function runElicitation(
  agentId: string,
  taskDescription: string,
  outputDir: string
): Promise<ElicitationResult | null> {
  const spinner = ora('Iniciando elicitação...').start()
  const engine = new ElicitorEngine(prisma)

  try {
    spinner.text = 'Analisando tarefa...'
    const session = await engine.start(agentId, taskDescription)

    spinner.succeed(`Tipo detectado: ${session.detectedType}`)

    let round = 0
    const maxRounds = 10

    while (round < maxRounds) {
      round++

      const completeness = engine.getCompleteness()
      if (completeness.canGenerate) {
        console.log(chalk.green(`\nCompletude: ${completeness.completenessScore}%`))
        break
      }

      spinner.start(`Rodada ${round}/${maxRounds}...`)
      const question = await engine.getNextQuestion()
      spinner.stop()

      if (!question) {
        console.log(chalk.yellow('\nLLM não gerou mais perguntas.'))
        break
      }

      const answer = await askQuestion(question as LLMQuestion)

      spinner.start('Processando resposta...')
      await engine.processAnswer(answer)
      spinner.stop()

      const progress = engine.getCompleteness()
      console.log(chalk.dim(`  Progresso: ${progress.completenessScore}%`))
    }

    spinner.start('Gerando contrato...')
    const result = await engine.generate(outputDir)
    spinner.succeed('Contrato gerado!')

    return result as ElicitationResult
  } catch (error) {
    spinner.fail('Erro durante elicitação')
    throw error
  }
}

async function validateWithUser(contractMd: string): Promise<boolean> {
  console.log('\n' + boxen(
    chalk.bold('Contrato Gerado'),
    { padding: 1, borderColor: 'green', borderStyle: 'round' }
  ))

  displayContract(contractMd)

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'O contrato está correto?',
      choices: [
        { name: 'Sim, prosseguir', value: 'approve' },
        { name: 'Não, ajustar algo', value: 'edit' },
        { name: 'Cancelar', value: 'cancel' },
      ],
    },
  ])

  if (action === 'cancel') {
    return false
  }

  if (action === 'edit') {
    console.log(chalk.yellow('Edição manual ainda não implementada. Use "aprovar" ou "cancelar".'))
    return validateWithUser(contractMd)
  }

  return true
}

async function saveOutputFiles(result: ElicitationResult, outputDir: string): Promise<void> {
  const spinner = ora('Salvando arquivos...').start()
  const fs = await import('fs/promises')
  const path = await import('path')

  const dir = path.join(outputDir, result.outputId)
  await fs.mkdir(dir, { recursive: true })

  await fs.writeFile(
    path.join(dir, 'plan.json'),
    JSON.stringify(result.planJson, null, 2)
  )

  await fs.writeFile(
    path.join(dir, 'contract.md'),
    result.contractMd
  )

  await fs.writeFile(
    path.join(dir, 'taskPrompt.md'),
    result.taskPrompt
  )

  spinner.succeed(`Arquivos salvos em: ${chalk.cyan(dir)}`)

  console.log(chalk.dim('  - plan.json'))
  console.log(chalk.dim('  - contract.md'))
  console.log(chalk.dim('  - taskPrompt.md'))
}

async function runGatekeeper(planJsonPath: string): Promise<void> {
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Deseja executar o Gatekeeper agora?',
      default: true,
    },
  ])

  if (!confirm) {
    console.log(chalk.dim(`\nPara validar depois: npx gatekeeper validate ${planJsonPath}`))
    return
  }

  const spinner = ora('Executando Gatekeeper...').start()
  spinner.info(`Execute: npx gatekeeper validate ${planJsonPath}`)
}
