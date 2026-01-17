#!/usr/bin/env node

import { Command } from 'commander'
import packageJson from '../../package.json' with { type: 'json' }
import { elicitCommand } from './commands/elicit.js'
import { agentsCommand } from './commands/agents.js'
import { sessionsCommand } from './commands/sessions.js'

const program = new Command()

program
  .name('gatekeeper')
  .description('Gatekeeper - TDD Validation Pipeline with AI-Powered Elicitation')
  .version(packageJson.version)

program.addCommand(elicitCommand)
program.addCommand(agentsCommand)
program.addCommand(sessionsCommand)

program.parse(process.argv)

if (!process.argv.slice(2).length) {
  program.outputHelp()
}

process.on('SIGINT', async () => {
  console.log('\n\nEncerrando gracefully...')
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n\nEncerrando gracefully...')
  process.exit(0)
})
