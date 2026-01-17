import { Command } from 'commander'
import chalk from 'chalk'
import Table from 'cli-table3'
import ora from 'ora'
import boxen from 'boxen'
import { PrismaClient } from '@prisma/client'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { ElicitationSessionRepository } from '../../repositories/ElicitationSessionRepository.js'
import { ElicitorEngine } from '../../elicitor/ElicitorEngine.js'
import { displayError } from '../ui/display.js'
import { askQuestion } from '../ui/prompts.js'
import { colorByStatus } from '../ui/colors.js'

const prisma = new PrismaClient()

export const sessionsCommand = new Command('sessions')
  .description('Listar sessões de elicitação')
  .option('-n, --limit <number>', 'Número de sessões', '10')
  .action(async (options) => {
    const repository = new ElicitationSessionRepository(prisma)
    const sessions = await repository.findRecent(parseInt(options.limit))

    if (sessions.length === 0) {
      console.log(chalk.yellow('Nenhuma sessão encontrada.'))
      await prisma.$disconnect()
      return
    }

    const table = new Table({
      head: ['ID', 'Tipo', 'Status', 'Score', 'Agente', 'Criado'],
      style: { head: ['cyan'] },
    })

    const sessionsWithAgents = sessions as Array<typeof sessions[number] & { agent?: { name?: string } }>

    for (const session of sessionsWithAgents) {
      table.push([
        session.outputId.substring(0, 20),
        session.detectedType,
        colorByStatus(session.status)(session.status),
        session.completenessScore ? `${session.completenessScore}%` : '-',
        session.agent?.name || '-',
        formatDistanceToNow(session.createdAt, { addSuffix: true, locale: ptBR }),
      ])
    }

    console.log(table.toString())
    await prisma.$disconnect()
  })

sessionsCommand
  .command('resume <outputId>')
  .description('Retomar sessão de elicitação pausada')
  .action(async (outputId: string) => {
    const repository = new ElicitationSessionRepository(prisma)
    const existing = await repository.findByOutputId(outputId)

    if (!existing) {
      displayError(`Sessão não encontrada: ${outputId}`)
      await prisma.$disconnect()
      return
    }

    if (existing.status !== 'IN_PROGRESS') {
      displayError(`Sessão não está em andamento: ${existing.status}`)
      await prisma.$disconnect()
      return
    }

    const engine = new ElicitorEngine(prisma)

    try {
      const session = await engine.resume(outputId)

      console.log(boxen(
        chalk.green('Sessão Retomada\n\n') +
        chalk.dim(`Output ID: ${session.outputId}\n`) +
        chalk.dim(`Tipo: ${session.detectedType}\n`) +
        chalk.dim(`Rodada: ${session.currentRound}/10\n`) +
        chalk.dim(`Completude: ${session.completenessScore}%`),
        { padding: 1, borderColor: 'green', borderStyle: 'round' }
      ))

      console.log(chalk.cyan('\nContinuando elicitação...\n'))

      const spinner = ora()
      let round = session.currentRound
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

        if (!question) break

        const answer = await askQuestion(question)

        spinner.start('Processando resposta...')
        await engine.processAnswer(answer)
        spinner.stop()

        const progress = engine.getCompleteness()
        console.log(chalk.dim(`  Progresso: ${progress.completenessScore}%`))
      }

      spinner.start('Gerando contrato...')
      const result = await engine.generate('artifacts')
      spinner.stop()

      console.log(chalk.green(`\nSessão completada! Arquivos em artifacts/${result.outputId}/`))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      displayError(`Erro ao retomar sessão: ${message}`)
    }

    await prisma.$disconnect()
  })
