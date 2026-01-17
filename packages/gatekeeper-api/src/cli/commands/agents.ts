import { Command } from 'commander'
import inquirer from 'inquirer'
import chalk from 'chalk'
import Table from 'cli-table3'
import ora from 'ora'
import { PrismaClient } from '@prisma/client'

import { LLMAgentRepository } from '../../repositories/LLMAgentRepository.js'
import { LLMAdapterFactory } from '../../elicitor/adapters/LLMAdapterFactory.js'
import { LLMProvider } from '../../elicitor/types/elicitor.types.js'
import { colorByProvider } from '../ui/colors.js'

const prisma = new PrismaClient()
const getErrorCode = (error: unknown): string | null => {
  if (!error || typeof error !== 'object') {
    return null
  }
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

export const agentsCommand = new Command('agents')
  .description('Gerenciar agentes LLM')

agentsCommand
  .command('list')
  .alias('ls')
  .description('Listar agentes configurados')
  .action(async () => {
    const repository = new LLMAgentRepository(prisma)
    const agents = await repository.findAll()

    if (agents.length === 0) {
      console.log(chalk.yellow('Nenhum agente configurado.'))
      return
    }

    const table = new Table({
      head: ['Nome', 'Provider', 'Model', 'Status', 'Default'],
      style: { head: ['cyan'] },
    })

    for (const agent of agents) {
      table.push([
        agent.name,
        colorByProvider(agent.provider)(agent.provider),
        agent.model,
        agent.isActive ? chalk.green('Ativo') : chalk.red('Inativo'),
        agent.isDefault ? chalk.green('★') : '',
      ])
    }

    console.log(table.toString())
    await prisma.$disconnect()
  })

agentsCommand
  .command('add')
  .description('Adicionar novo agente')
  .action(async () => {
    const factory = LLMAdapterFactory.getInstance()
    const providers = factory.getSupportedProviders()

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Nome do agente:',
        validate: (input) => input.trim() ? true : 'Nome é obrigatório',
      },
      {
        type: 'list',
        name: 'provider',
        message: 'Provider:',
        choices: providers,
      },
      {
        type: 'input',
        name: 'model',
        message: 'Modelo:',
        default: (input: Record<string, unknown>) => {
          const provider = typeof input.provider === 'string' ? input.provider : ''
          const defaults: Record<string, string> = {
            [LLMProvider.ANTHROPIC]: 'claude-sonnet-4-20250514',
            [LLMProvider.OPENAI]: 'gpt-4-turbo',
            [LLMProvider.GOOGLE]: 'gemini-pro',
            [LLMProvider.OLLAMA]: 'llama3.2',
          }
          return defaults[provider] || ''
        },
      },
      {
        type: 'list',
        name: 'authType',
        message: 'Como fornecer API Key?',
        choices: [
          { name: 'Variável de ambiente', value: 'env' },
          { name: 'Digitar agora', value: 'direct' },
        ],
        when: (input) => input.provider !== LLMProvider.OLLAMA,
      },
      {
        type: 'input',
        name: 'apiKeyEnvVar',
        message: 'Nome da variável de ambiente:',
        default: (input: Record<string, unknown>) => {
          const provider = typeof input.provider === 'string' ? input.provider : ''
          const defaults: Record<string, string> = {
            [LLMProvider.ANTHROPIC]: 'ANTHROPIC_API_KEY',
            [LLMProvider.OPENAI]: 'OPENAI_API_KEY',
            [LLMProvider.GOOGLE]: 'GOOGLE_API_KEY',
          }
          return defaults[provider] || ''
        },
        when: (input) => input.authType === 'env',
      },
      {
        type: 'password',
        name: 'apiKey',
        message: 'API Key:',
        when: (input) => input.authType === 'direct',
      },
      {
        type: 'input',
        name: 'baseUrl',
        message: 'Base URL (Ollama):',
        default: 'http://localhost:11434',
        when: (input) => input.provider === LLMProvider.OLLAMA,
      },
      {
        type: 'input',
        name: 'temperature',
        message: 'Temperature:',
        default: '0.7',
        validate: (input) => {
          const value = Number(input)
          if (Number.isNaN(value)) return 'Informe um número válido.'
          return true
        },
      },
      {
        type: 'input',
        name: 'maxTokens',
        message: 'Max tokens:',
        default: '4096',
        validate: (input) => {
          const value = Number(input)
          if (!Number.isInteger(value) || value <= 0) return 'Informe um número inteiro válido.'
          return true
        },
      },
      {
        type: 'confirm',
        name: 'isDefault',
        message: 'Definir como agente padrão?',
        default: false,
      },
    ])

    const slug = answers.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    const repository = new LLMAgentRepository(prisma)

    try {
      const agent = await repository.create({
        name: answers.name,
        slug,
        provider: answers.provider,
        model: answers.model,
        apiKey: answers.apiKey || null,
        apiKeyEnvVar: answers.apiKeyEnvVar || null,
        baseUrl: answers.baseUrl || null,
        temperature: Number(answers.temperature),
        maxTokens: Number(answers.maxTokens),
        isActive: true,
        isDefault: answers.isDefault,
        sortOrder: 0,
        systemPromptId: null,
      })

      if (answers.isDefault) {
        await repository.setDefault(agent.id)
      }

      console.log(chalk.green(`\nAgente "${agent.name}" criado com sucesso!`))
    } catch (error: unknown) {
      if (getErrorCode(error) === 'P2002') {
        console.error(chalk.red('\nJá existe um agente com esse nome.'))
      } else {
        throw error
      }
    }

    await prisma.$disconnect()
  })

agentsCommand
  .command('remove <slug>')
  .alias('rm')
  .description('Remover agente')
  .action(async (slug: string) => {
    const repository = new LLMAgentRepository(prisma)
    const agent = await repository.findBySlug(slug)

    if (!agent) {
      console.error(chalk.red(`Agente não encontrado: ${slug}`))
      await prisma.$disconnect()
      return
    }

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Remover agente "${agent.name}"?`,
        default: false,
      },
    ])

    if (confirm) {
      await repository.delete(agent.id)
      console.log(chalk.green(`Agente "${agent.name}" removido.`))
    }

    await prisma.$disconnect()
  })

agentsCommand
  .command('test <slug>')
  .description('Testar conexão com agente')
  .action(async (slug: string) => {
    const repository = new LLMAgentRepository(prisma)
    const agent = await repository.findBySlug(slug)

    if (!agent) {
      console.error(chalk.red(`Agente não encontrado: ${slug}`))
      await prisma.$disconnect()
      return
    }

    const spinner = ora(`Testando conexão com ${agent.name}...`).start()

    const { LLMAdapterManager } = await import('../../elicitor/adapters/LLMAdapterManager.js')
    const manager = new LLMAdapterManager(prisma)

    try {
      const start = Date.now()
      const isValid = await manager.validateAgent(agent.id)
      const durationMs = Date.now() - start

      if (isValid) {
        spinner.succeed(`Conexão OK! (${durationMs}ms)`)
      } else {
        spinner.fail(`Falha na conexão. Verifique API key. (${durationMs}ms)`)
      }
    } catch (error) {
      spinner.fail(`Erro: ${error}`)
    }

    await prisma.$disconnect()
  })
