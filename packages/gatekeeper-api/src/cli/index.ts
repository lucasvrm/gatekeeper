#!/usr/bin/env node

import { Command } from 'commander'
import packageJson from '../../package.json' with { type: 'json' }
const program = new Command()

program
  .name('gatekeeper')
  .description('Gatekeeper - TDD Validation Pipeline')
  .version(packageJson.version)

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
