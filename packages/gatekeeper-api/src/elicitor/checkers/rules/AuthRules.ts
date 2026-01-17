// ============================================================================
// AUTH COMPLETENESS RULES
// ============================================================================
// Baseado em: AuthContract.json + AUTH.md + AUTH.json

import { FieldDefinition, FieldPriority, ICompletenessRules } from '../types.js'
import { ElicitationState, TaskType } from '../../types/elicitor.types.js'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toRecordArray = (value: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(isRecord)
}

const getString = (value: unknown): string => (typeof value === 'string' ? value : '')

const getStateValue = (state: ElicitationState, key: string): unknown =>
  (state as unknown as Record<string, unknown>)[key]

export class AuthRules implements ICompletenessRules {
  readonly taskType = TaskType.AUTH
  readonly minScoreToGenerate = 70
  readonly minScoreComplete = 90

  readonly fields: FieldDefinition[] = [
    // ========================================================================
    // CRITICAL FIELDS (peso 10)
    // ========================================================================
    {
      name: 'Tipo de Fluxo',
      path: 'type',
      priority: FieldPriority.CRITICAL,
      weight: 10,
      description: 'Tipo de autentica‡Æo (login, register, logout, etc)',
      validator: (value) => {
        const validTypes = [
          'login', 'register', 'logout', 'password_reset_request',
          'password_reset_confirm', 'password_change', 'email_verification',
          'social_login', 'mfa_setup', 'mfa_verify',
        ]
        const type = getString(value)
        const isValid = validTypes.includes(type)
        return {
          isValid,
          isFilled: !!type,
          score: isValid ? 100 : type ? 50 : 0,
          message: !type ? 'Tipo de fluxo ‚ obrigat¢rio' : 'Tipo inv lido',
        }
      },
    },
    {
      name: 'Campos de Credencial',
      path: 'credentials',
      priority: FieldPriority.CRITICAL,
      weight: 10,
      description: 'Campos necess rios (email, senha, etc)',
      validator: (value) => {
        const creds = toRecordArray(value)
        const hasCreds = creds.length > 0
        const hasComplete = hasCreds && creds.every((c) => Boolean(c.name) && Boolean(c.type) && typeof c.required === 'boolean')
        return {
          isValid: hasComplete,
          isFilled: hasCreds,
          score: hasComplete ? 100 : hasCreds ? 60 : 0,
          message: !hasCreds
            ? 'Defina os campos de credencial'
            : 'Campos precisam de: name, type, required',
        }
      },
    },
    {
      name: 'Pol¡tica de Senha',
      path: 'passwordPolicy',
      priority: FieldPriority.CRITICAL,
      weight: 10,
      description: 'Requisitos de senha (comprimento, caracteres)',
      validator: (value, state) => {
        const type = getString(getStateValue(state, 'type'))
        const needsPassword = ['register', 'password_reset_confirm', 'password_change'].includes(type)

        if (!needsPassword) {
          return { isValid: true, isFilled: true, score: 100 }
        }

        const policy = isRecord(value) ? value : null
        const minLength = typeof policy?.minLength === 'number' ? policy.minLength : null
        const hasDef = minLength !== null && minLength >= 6
        return {
          isValid: hasDef,
          isFilled: !!policy,
          score: hasDef ? 100 : policy ? 60 : 0,
          message: needsPassword && !policy
            ? 'Defina pol¡tica de senha'
            : policy && !hasDef
              ? 'minLength ‚ obrigat¢rio e deve ser >= 6'
              : undefined,
        }
      },
    },
    {
      name: 'Redirecionamentos',
      path: 'redirects',
      priority: FieldPriority.CRITICAL,
      weight: 10,
      description: 'Para onde ir ap¢s sucesso/cancelamento',
      validator: (value) => {
        const redirects = isRecord(value) ? value : null
        const hasDef = Boolean(redirects && (redirects.afterSuccess || redirects.afterLogout || redirects.afterRegister))
        return {
          isValid: hasDef,
          isFilled: !!redirects,
          score: hasDef ? 100 : 0,
          message: !redirects ? 'Defina redirecionamentos' : 'Pelo menos um redirect ‚ necess rio',
        }
      },
    },

    // ========================================================================
    // IMPORTANT FIELDS (peso 7-9)
    // ========================================================================
    {
      name: 'Configura‡Æo de SessÆo',
      path: 'session',
      priority: FieldPriority.IMPORTANT,
      weight: 9,
      description: 'Dura‡Æo, storage, renova‡Æo da sessÆo',
      validator: (value, state) => {
        const type = getString(getStateValue(state, 'type'))
        const needsSession = ['login', 'social_login'].includes(type)

        if (!needsSession) {
          return { isValid: true, isFilled: true, score: 100 }
        }

        const session = isRecord(value) ? value : null
        const hasDef = Boolean(session && (session.duration || session.storage))
        return {
          isValid: hasDef,
          isFilled: !!session,
          score: hasDef ? 100 : 0,
          message: needsSession && !session
            ? 'Defina configura‡Æo de sessÆo'
            : !hasDef
              ? 'Defina pelo menos duration ou storage'
              : undefined,
        }
      },
    },
    {
      name: 'Seguran‡a - Brute Force',
      path: 'security.bruteForce',
      priority: FieldPriority.IMPORTANT,
      weight: 8,
      description: 'Prote‡Æo contra tentativas m£ltiplas',
      validator: (value, state) => {
        const type = getString(getStateValue(state, 'type'))
        const needsSecurity = ['login', 'password_reset_request'].includes(type)

        if (!needsSecurity) {
          return { isValid: true, isFilled: true, score: 100 }
        }

        const bf = isRecord(value) ? value : null
        const enabled = typeof bf?.enabled === 'boolean' ? bf.enabled : null
        const hasMaxAttempts = typeof bf?.maxAttempts === 'number' && bf.maxAttempts > 0
        const hasDef = enabled !== null && (hasMaxAttempts || !enabled)
        return {
          isValid: hasDef,
          isFilled: !!bf,
          score: hasDef ? 100 : bf ? 70 : 0,
          message: needsSecurity && !bf
            ? 'Defina prote‡Æo brute force'
            : bf && !hasDef
              ? 'Se enabled=true, maxAttempts ‚ obrigat¢rio'
              : undefined,
        }
      },
    },
    {
      name: 'Mensagens de Erro',
      path: 'messages.errors',
      priority: FieldPriority.IMPORTANT,
      weight: 8,
      description: 'Mensagens customizadas de erro',
      validator: (value) => {
        const errors = isRecord(value) ? value : null
        const hasDef = Boolean(errors && Object.keys(errors).length > 0)
        return {
          isValid: hasDef,
          isFilled: hasDef,
          score: hasDef ? 100 : 0,
          message: !errors ? 'Defina mensagens de erro' : undefined,
        }
      },
    },
    {
      name: 'Mensagens de Sucesso',
      path: 'messages.success',
      priority: FieldPriority.IMPORTANT,
      weight: 7,
      description: 'Mensagens de feedback positivo',
      validator: (value) => {
        const success = isRecord(value) ? value : null
        const hasDef = Boolean(success && Object.keys(success).length > 0)
        return {
          isValid: true,
          isFilled: hasDef,
          score: hasDef ? 100 : 80,
        }
      },
    },

    // ========================================================================
    // OPTIONAL FIELDS (peso 5-7)
    // ========================================================================
    {
      name: 'Verifica‡Æo de Email',
      path: 'security.emailVerification',
      priority: FieldPriority.OPTIONAL,
      weight: 7,
      description: 'Se requer verifica‡Æo de email',
      validator: (value, state) => {
        const type = getString(getStateValue(state, 'type'))
        const isRegister = type === 'register'

        if (!isRegister) {
          return { isValid: true, isFilled: true, score: 100 }
        }

        const emailVerif = isRecord(value) ? value : null
        const hasDef = Boolean(emailVerif && typeof emailVerif.required === 'boolean')
        return {
          isValid: true,
          isFilled: hasDef,
          score: hasDef ? 100 : 80,
        }
      },
    },
    {
      name: 'Login Social',
      path: 'socialProviders',
      priority: FieldPriority.OPTIONAL,
      weight: 6,
      description: 'Provedores de login social (Google, etc)',
      validator: (value) => {
        const providers = toRecordArray(value)
        const hasProviders = providers.length > 0
        const hasComplete = hasProviders && providers.every((p) => Boolean(p.provider) && typeof p.enabled === 'boolean')
        return {
          isValid: true,
          isFilled: hasProviders,
          score: hasComplete ? 100 : hasProviders ? 80 : 90,
        }
      },
    },
    {
      name: 'CAPTCHA',
      path: 'security.captcha',
      priority: FieldPriority.OPTIONAL,
      weight: 6,
      description: 'Configura‡Æo de CAPTCHA',
      validator: (value) => {
        const captcha = isRecord(value) ? value : null
        const hasDef = Boolean(captcha && typeof captcha.enabled === 'boolean')
        return {
          isValid: true,
          isFilled: hasDef,
          score: hasDef ? 100 : 90,
        }
      },
    },
    {
      name: 'Two-Factor Auth (2FA)',
      path: 'mfa',
      priority: FieldPriority.OPTIONAL,
      weight: 6,
      description: 'Autentica‡Æo em dois fatores',
      validator: (value) => {
        const mfa = isRecord(value) ? value : null
        const hasDef = Boolean(mfa && typeof mfa.enabled === 'boolean')
        return {
          isValid: true,
          isFilled: hasDef,
          score: hasDef ? 100 : 85,
        }
      },
    },
    {
      name: 'Fluxos Detalhados',
      path: 'flows',
      priority: FieldPriority.OPTIONAL,
      weight: 5,
      description: 'Fluxo de sucesso e erros passo a passo',
      validator: (value) => {
        const flows = isRecord(value) ? value : null
        const success = flows?.success
        const errors = flows?.errors
        const hasSuccess = Array.isArray(success)
        const hasErrors = Array.isArray(errors)
        return {
          isValid: true,
          isFilled: hasSuccess || hasErrors,
          score: (hasSuccess && hasErrors) ? 100 : (hasSuccess || hasErrors) ? 85 : 90,
        }
      },
    },
    {
      name: 'Labels Customizados',
      path: 'messages.labels',
      priority: FieldPriority.OPTIONAL,
      weight: 5,
      description: 'Labels personalizados de UI',
      validator: (value) => {
        const labels = isRecord(value) ? value : null
        const hasDef = Boolean(labels && Object.keys(labels).length > 0)
        return {
          isValid: true,
          isFilled: hasDef,
          score: hasDef ? 100 : 90,
        }
      },
    },
  ]

  getFieldDefinitions(): FieldDefinition[] {
    return this.fields
  }

  getRequiredFields(): FieldDefinition[] {
    return this.fields.filter((field) => field.priority === FieldPriority.CRITICAL || field.priority === FieldPriority.IMPORTANT)
  }

  getOptionalFields(): FieldDefinition[] {
    return this.fields.filter((field) => field.priority === FieldPriority.OPTIONAL)
  }
}
