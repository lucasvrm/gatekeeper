/**
 * Strip ANSI escape codes from a string
 * ANSI codes are used for terminal colors and formatting
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  const ansiRegex = /\u001b\[[0-9;]*[a-zA-Z]|\u001b\][0-9;]*;[^\u0007]*\u0007/g
  return str.replace(ansiRegex, '')
}
