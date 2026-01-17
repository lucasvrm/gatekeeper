import chalk, { type ChalkInstance } from 'chalk'
import { PROVIDER_COLORS } from '../../shared/constants.js'

export const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.cyan,
  header: chalk.bold.cyan,
  subheader: chalk.bold.white,
  label: chalk.dim,
  value: chalk.white,
  highlight: chalk.bold.yellow,
  critical: chalk.red,
  important: chalk.yellow,
  optional: chalk.gray,
  anthropic: chalk.hex(PROVIDER_COLORS.anthropic.hex),
  openai: chalk.hex(PROVIDER_COLORS.openai.hex),
  google: chalk.hex(PROVIDER_COLORS.google.hex),
  ollama: chalk.hex(PROVIDER_COLORS.ollama.hex),
}

export function colorByProvider(provider: string): ChalkInstance {
  const providerColors: Record<string, ChalkInstance> = {
    anthropic: colors.anthropic,
    openai: colors.openai,
    google: colors.google,
    ollama: colors.ollama,
  }
  return providerColors[provider] || chalk.white
}

export function colorByStatus(status: string): ChalkInstance {
  const map: Record<string, ChalkInstance> = {
    COMPLETED: colors.success,
    IN_PROGRESS: colors.warning,
    CANCELLED: chalk.gray,
    ERROR: colors.error,
    PASSED: colors.success,
    FAILED: colors.error,
    SKIPPED: chalk.gray,
  }
  return map[status] || chalk.white
}
