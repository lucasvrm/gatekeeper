import chalk from 'chalk'
import { marked } from 'marked'
import { markedTerminal } from 'marked-terminal'

marked.use(markedTerminal())

export function displayContract(markdown: string): void {
  const rendered = marked(markdown)
  console.log(rendered)
}

export function displayProgress(current: number, total: number, label: string): void {
  const percentage = Math.round((current / total) * 100)
  const filled = Math.round(percentage / 5)
  const empty = 20 - filled

  const bar = chalk.green('#'.repeat(filled)) + chalk.gray('-'.repeat(empty))

  console.log(`${label} [${bar}] ${percentage}%`)
}

export function displayScore(score: number): void {
  let color = chalk.red
  if (score >= 90) color = chalk.green
  else if (score >= 70) color = chalk.yellow
  else if (score >= 50) color = chalk.hex('#FFA500')

  console.log(`Completude: ${color(`${score}%`)}`)
}

export function displayError(message: string): void {
  console.error(chalk.red(`\n! ${message}`))
}

export function displaySuccess(message: string): void {
  console.log(chalk.green(`\n+ ${message}`))
}

export function displayWarning(message: string): void {
  console.log(chalk.yellow(`\n! ${message}`))
}

export function displayInfo(message: string): void {
  console.log(chalk.cyan(`\n> ${message}`))
}
