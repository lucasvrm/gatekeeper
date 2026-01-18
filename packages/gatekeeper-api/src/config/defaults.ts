/**
 * Default values for git references used across the application.
 * These are the single source of truth for git ref defaults.
 */
export const DEFAULT_GIT_REFS = {
  BASE_REF: 'origin/main',
  TARGET_REF: 'HEAD',
} as const

/**
 * Default values for validation runs.
 */
export const DEFAULT_RUN_CONFIG = {
  DANGER_MODE: false,
  RUN_TYPE: 'CONTRACT',
} as const

/**
 * Default values for sensitive file patterns that trigger danger mode.
 */
export const SENSITIVE_FILE_PATTERNS = [
  '.env*',
  '**/.env',
  '**/migrations/**',
  '**/.github/**',
  '**/*.pem',
  '**/*.key',
] as const
