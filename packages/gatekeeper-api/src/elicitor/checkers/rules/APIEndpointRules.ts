// ============================================================================
// API_ENDPOINT COMPLETENESS RULES
// ============================================================================
// Baseado em: APIEndpointContract.json + API_ENDPOINT.md + API_ENDPOINT.json

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

export class APIEndpointRules implements ICompletenessRules {
  readonly taskType = TaskType.API_ENDPOINT
  readonly minScoreToGenerate = 70
  readonly minScoreComplete = 90

  readonly fields: FieldDefinition[] = [
    // ========================================================================
    // CRITICAL FIELDS (peso 10)
    // ========================================================================
    {
      name: 'M‚todo HTTP',
      path: 'method',
      priority: FieldPriority.CRITICAL,
      weight: 10,
      description: 'M‚todo HTTP do endpoint (GET, POST, PUT, PATCH, DELETE)',
      validator: (value) => {
        const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
        const method = getString(value)
        const isValid = validMethods.includes(method)
        return {
          isValid,
          isFilled: !!method,
          score: isValid ? 100 : method ? 50 : 0,
          message: !method ? 'M‚todo HTTP ‚ obrigat¢rio' : !isValid ? 'M‚todo inv lido' : undefined,
        }
      },
    },
    {
      name: 'Path do Endpoint',
      path: 'path',
      priority: FieldPriority.CRITICAL,
      weight: 10,
      description: 'Caminho do endpoint (deve come‡ar com /)',
      validator: (value) => {
        const path = getString(value)
        const isValid = path.length > 1 && path.startsWith('/')
        return {
          isValid,
          isFilled: !!path,
          score: isValid ? 100 : path ? 50 : 0,
          message: !path ? 'Path ‚ obrigat¢rio' : !isValid ? 'Path deve come‡ar com /' : undefined,
        }
      },
    },
    {
      name: 'Descri‡Æo',
      path: 'description',
      priority: FieldPriority.CRITICAL,
      weight: 10,
      description: 'O que o endpoint faz (uma frase clara)',
      validator: (value) => {
        const desc = getString(value)
        const isValid = desc.length >= 10
        return {
          isValid,
          isFilled: !!desc,
          score: isValid ? 100 : desc ? 60 : 0,
          message: !desc ? 'Descri‡Æo ‚ obrigat¢ria' : 'Descri‡Æo muito curta (m¡nimo 10 caracteres)',
        }
      },
    },
    {
      name: 'Resposta de Sucesso',
      path: 'response.success',
      priority: FieldPriority.CRITICAL,
      weight: 10,
      description: 'Defini‡Æo da resposta de sucesso (status + body)',
      validator: (value) => {
        const success = isRecord(value) ? value : null
        const status = success?.status
        const hasStatus = typeof status === 'number' && [200, 201, 204].includes(status)
        return {
          isValid: hasStatus,
          isFilled: !!success,
          score: hasStatus ? 100 : success ? 60 : 0,
          message: !success ? 'Resposta de sucesso ‚ obrigat¢ria' : 'Status deve ser 200, 201 ou 204',
        }
      },
    },

    // ========================================================================
    // IMPORTANT FIELDS (peso 7-9)
    // ========================================================================
    {
      name: 'Request Body',
      path: 'request.body',
      priority: FieldPriority.IMPORTANT,
      weight: 9,
      description: 'Defini‡Æo do body para POST/PUT/PATCH',
      validator: (value, state) => {
        const method = getString(getStateValue(state, 'method'))
        const needsBody = ['POST', 'PUT', 'PATCH'].includes(method)

        if (!needsBody) {
          return { isValid: true, isFilled: true, score: 100 }
        }

        const body = isRecord(value) ? value : null
        const schema = body?.schema
        const hasSchema = isRecord(schema)
        return {
          isValid: hasSchema,
          isFilled: !!body,
          score: hasSchema ? 100 : body ? 60 : 0,
          message: needsBody && !body ? 'Body ‚ necess rio para este m‚todo' : !hasSchema ? 'Body precisa de schema' : undefined,
        }
      },
    },
    {
      name: 'Autentica‡Æo',
      path: 'authentication',
      priority: FieldPriority.IMPORTANT,
      weight: 8,
      description: 'Se requer autentica‡Æo e qual tipo',
      validator: (value) => {
        const auth = isRecord(value) ? value : null
        const isDefined = Boolean(auth && typeof auth.required === 'boolean')
        return {
          isValid: isDefined,
          isFilled: !!auth,
          score: isDefined ? 100 : 0,
          message: !auth ? 'Defina se requer autentica‡Æo' : 'Campo "required" ‚ obrigat¢rio',
        }
      },
    },
    {
      name: 'Cen rios de Erro',
      path: 'response.errors',
      priority: FieldPriority.IMPORTANT,
      weight: 8,
      description: 'Pelo menos um cen rio de erro definido',
      validator: (value) => {
        const errors = toRecordArray(value)
        const hasErrors = errors.length > 0
        const hasComplete = hasErrors && errors.every((e) => Boolean(e.scenario) && Boolean(e.status) && Boolean(e.body))
        return {
          isValid: hasComplete,
          isFilled: hasErrors,
          score: hasComplete ? 100 : hasErrors ? 60 : 0,
          message: !hasErrors ? 'Defina pelo menos um cen rio de erro' : 'Erros precisam de scenario, status e body',
        }
      },
    },
    {
      name: 'Path Parameters',
      path: 'request.params',
      priority: FieldPriority.IMPORTANT,
      weight: 7,
      description: 'Parƒmetros de URL (se path tiver :id, etc)',
      validator: (value, state) => {
        const path = getString(getStateValue(state, 'path'))
        const hasParamsInPath = path.includes(':')

        if (!hasParamsInPath) {
          return { isValid: true, isFilled: true, score: 100 }
        }

        const params = isRecord(value) ? value : null
        const isDefined = Boolean(params && Object.keys(params).length > 0)
        return {
          isValid: isDefined,
          isFilled: !!params,
          score: isDefined ? 100 : 0,
          message: hasParamsInPath && !params ? 'Defina os parƒmetros de URL encontrados no path' : undefined,
        }
      },
    },

    // ========================================================================
    // OPTIONAL FIELDS (peso 5-7)
    // ========================================================================
    {
      name: 'Autoriza‡Æo',
      path: 'authorization',
      priority: FieldPriority.OPTIONAL,
      weight: 7,
      description: 'Regras de autoriza‡Æo (roles, scopes, ownership)',
      validator: (value, state) => {
        const auth = getStateValue(state, 'authentication')
        const authRecord = isRecord(auth) ? auth : null
        const requiresAuth = authRecord?.required !== false

        if (!requiresAuth) {
          return { isValid: true, isFilled: true, score: 100 }
        }

        const authz = isRecord(value) ? value : null
        const hasDef = Boolean(authz && (authz.roles || authz.scopes || typeof authz.checkOwnership === 'boolean'))
        return {
          isValid: true,
          isFilled: hasDef,
          score: hasDef ? 100 : 80,
        }
      },
    },
    {
      name: 'Query Parameters',
      path: 'request.query',
      priority: FieldPriority.OPTIONAL,
      weight: 6,
      description: 'Parƒmetros de query string (filtros, pagina‡Æo)',
      validator: (value, state) => {
        const method = getString(getStateValue(state, 'method'))
        const isGet = method === 'GET'

        const query = isRecord(value) ? value : null
        const hasDef = Boolean(query && Object.keys(query).length > 0)
        return {
          isValid: true,
          isFilled: hasDef,
          score: hasDef ? 100 : isGet ? 70 : 90,
        }
      },
    },
    {
      name: 'Valida‡äes de Schema',
      path: 'request.body.schema.properties',
      priority: FieldPriority.OPTIONAL,
      weight: 6,
      description: 'Schema JSON com valida‡äes de campos',
      validator: (value, state) => {
        const request = getStateValue(state, 'request')
        const requestRecord = isRecord(request) ? request : null
        const body = requestRecord ? requestRecord.body : null
        if (!body) {
          return { isValid: true, isFilled: true, score: 100 }
        }

        const props = isRecord(value) ? value : null
        const hasProps = Boolean(props && Object.keys(props).length > 0)
        return {
          isValid: true,
          isFilled: hasProps,
          score: hasProps ? 100 : 80,
        }
      },
    },
    {
      name: 'Rate Limiting',
      path: 'rateLimit',
      priority: FieldPriority.OPTIONAL,
      weight: 5,
      description: 'Configura‡Æo de rate limiting (se aplic vel)',
      validator: (value) => {
        const rateLimit = isRecord(value) ? value : null
        const hasDef = Boolean(rateLimit && typeof rateLimit.enabled === 'boolean')
        return {
          isValid: true,
          isFilled: hasDef,
          score: hasDef ? 100 : 90,
        }
      },
    },
    {
      name: 'Efeitos Colaterais',
      path: 'sideEffects',
      priority: FieldPriority.OPTIONAL,
      weight: 5,
      description: 'A‡äes que ocorrem al‚m da opera‡Æo principal',
      validator: (value, state) => {
        const method = getString(getStateValue(state, 'method'))
        const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)

        const effects = toRecordArray(value)
        const hasEffects = effects.length > 0
        return {
          isValid: true,
          isFilled: hasEffects,
          score: hasEffects ? 100 : isWrite ? 80 : 95,
        }
      },
    },
    {
      name: 'Exemplos de Request',
      path: 'request.body.examples',
      priority: FieldPriority.OPTIONAL,
      weight: 5,
      description: 'Exemplos de requisi‡Æo com expected outcome',
      validator: (value, state) => {
        const request = getStateValue(state, 'request')
        const requestRecord = isRecord(request) ? request : null
        const body = requestRecord ? requestRecord.body : null
        if (!body) {
          return { isValid: true, isFilled: true, score: 100 }
        }

        const examples = toRecordArray(value)
        const hasExamples = examples.length > 0
        const hasComplete = hasExamples && examples.every((ex) => Boolean(ex.value) && Boolean(ex.expectedOutcome))
        return {
          isValid: true,
          isFilled: hasExamples,
          score: hasComplete ? 100 : hasExamples ? 80 : 85,
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
