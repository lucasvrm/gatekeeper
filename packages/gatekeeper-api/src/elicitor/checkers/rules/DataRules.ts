// ============================================================================
// DATA COMPLETENESS RULES
// ============================================================================
// Baseado em: DataContract.json + DATA.md + DATA.json

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

export class DataRules implements ICompletenessRules {
  readonly taskType = TaskType.DATA
  readonly minScoreToGenerate = 70
  readonly minScoreComplete = 90

  readonly fields: FieldDefinition[] = [
    // ========================================================================
    // CRITICAL FIELDS (peso 10)
    // ========================================================================
    {
      name: 'Nome da Entidade',
      path: 'entity',
      priority: FieldPriority.CRITICAL,
      weight: 10,
      description: 'Nome da entidade/tabela',
      validator: (value) => {
        const entity = getString(value)
        const isValid = !!entity && /^[A-Z][a-zA-Z0-9]*$/.test(entity)
        return {
          isValid,
          isFilled: !!entity,
          score: isValid ? 100 : entity ? 60 : 0,
          message: !entity ? 'Nome da entidade ‚ obrigat¢rio' : 'Deve ser PascalCase (ex: Lead, Task)',
        }
      },
    },
    {
      name: 'Opera‡Æo',
      path: 'operation',
      priority: FieldPriority.CRITICAL,
      weight: 10,
      description: 'Tipo de opera‡Æo (create, read, update, delete, list)',
      validator: (value) => {
        const validOps = ['create', 'read', 'update', 'delete', 'list', 'bulk_create', 'bulk_update', 'bulk_delete']
        const op = getString(value)
        const isValid = validOps.includes(op)
        return {
          isValid,
          isFilled: !!op,
          score: isValid ? 100 : op ? 50 : 0,
          message: !op ? 'Opera‡Æo ‚ obrigat¢ria' : 'Opera‡Æo inv lida',
        }
      },
    },
    {
      name: 'Campos da Entidade',
      path: 'fields',
      priority: FieldPriority.CRITICAL,
      weight: 10,
      description: 'Defini‡Æo dos campos (pelo menos 1)',
      validator: (value) => {
        const fields = toRecordArray(value)
        const hasFields = fields.length > 0
        const hasComplete = hasFields && fields.every((f) => Boolean(f.name) && Boolean(f.type))
        return {
          isValid: hasComplete,
          isFilled: hasFields,
          score: hasComplete ? 100 : hasFields ? 60 : 0,
          message: !hasFields ? 'Defina os campos da entidade' : 'Campos precisam de name e type',
        }
      },
    },

    // ========================================================================
    // IMPORTANT FIELDS (peso 7-9)
    // ========================================================================
    {
      name: 'Campos Obrigat¢rios',
      path: 'fields',
      priority: FieldPriority.IMPORTANT,
      weight: 9,
      description: 'Pelo menos um campo marcado como obrigat¢rio',
      validator: (value) => {
        const fields = toRecordArray(value)
        if (fields.length === 0) {
          return { isValid: false, isFilled: false, score: 0 }
        }

        const hasRequired = fields.some((f) => f.required === true)
        return {
          isValid: hasRequired,
          isFilled: hasRequired,
          score: hasRequired ? 100 : 70,
          message: !hasRequired ? 'Marque quais campos sÆo obrigat¢rios' : undefined,
        }
      },
    },
    {
      name: 'Valida‡äes',
      path: 'validations',
      priority: FieldPriority.IMPORTANT,
      weight: 8,
      description: 'Regras de valida‡Æo de neg¢cio',
      validator: (value) => {
        const validations = toRecordArray(value)
        const hasValidations = validations.length > 0
        const hasComplete = hasValidations && validations.every((v) => Boolean(v.rule) && Boolean(v.errorMessage))
        return {
          isValid: hasComplete || !hasValidations,
          isFilled: hasValidations,
          score: hasComplete ? 100 : hasValidations ? 70 : 85,
        }
      },
    },
    {
      name: 'Permissäes',
      path: 'permissions',
      priority: FieldPriority.IMPORTANT,
      weight: 8,
      description: 'Quem pode criar/ler/editar/deletar',
      validator: (value) => {
        const perms = isRecord(value) ? value : null
        const hasDef = Boolean(perms && (perms.create || perms.read || perms.update || perms.delete))
        return {
          isValid: hasDef,
          isFilled: !!perms,
          score: hasDef ? 100 : 0,
          message: !perms ? 'Defina permissäes de acesso' : 'Defina pelo menos uma opera‡Æo',
        }
      },
    },
    {
      name: 'Configura‡Æo de Dele‡Æo',
      path: 'deletion',
      priority: FieldPriority.IMPORTANT,
      weight: 7,
      description: 'Tipo de dele‡Æo (hard/soft) e comportamento',
      validator: (value, state) => {
        const operation = getString(getStateValue(state, 'operation'))
        const isDelete = operation === 'delete' || operation === 'bulk_delete'

        if (!isDelete) {
          return { isValid: true, isFilled: true, score: 100 }
        }

        const deletion = isRecord(value) ? value : null
        const hasDef = Boolean(deletion && deletion.type)
        return {
          isValid: hasDef,
          isFilled: !!deletion,
          score: hasDef ? 100 : 0,
          message: isDelete && !deletion ? 'Defina tipo de dele‡Æo (hard/soft)' : undefined,
        }
      },
    },

    // ========================================================================
    // OPTIONAL FIELDS (peso 5-7)
    // ========================================================================
    {
      name: 'Relacionamentos',
      path: 'relationships',
      priority: FieldPriority.OPTIONAL,
      weight: 7,
      description: 'Relacionamentos com outras entidades',
      validator: (value) => {
        const rels = toRecordArray(value)
        const hasRels = rels.length > 0
        const hasComplete = hasRels && rels.every((r) => Boolean(r.name) && Boolean(r.target) && Boolean(r.type))
        return {
          isValid: true,
          isFilled: hasRels,
          score: hasComplete ? 100 : hasRels ? 80 : 90,
        }
      },
    },
    {
      name: 'Auditoria',
      path: 'audit',
      priority: FieldPriority.OPTIONAL,
      weight: 6,
      description: 'Configura‡Æo de rastreamento de mudan‡as',
      validator: (value) => {
        const audit = isRecord(value) ? value : null
        const hasDef = Boolean(audit && typeof audit.enabled === 'boolean')
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
      weight: 6,
      description: 'A‡äes que ocorrem ap¢s opera‡Æo',
      validator: (value) => {
        const effects = toRecordArray(value)
        const hasEffects = effects.length > 0
        const hasComplete = hasEffects && effects.every((e) => Boolean(e.trigger) && Boolean(e.action))
        return {
          isValid: true,
          isFilled: hasEffects,
          score: hasComplete ? 100 : hasEffects ? 80 : 90,
        }
      },
    },
    {
      name: 'Öndices',
      path: 'indexes',
      priority: FieldPriority.OPTIONAL,
      weight: 6,
      description: 'Öndices de banco de dados para performance',
      validator: (value) => {
        const indexes = toRecordArray(value)
        const hasIndexes = indexes.length > 0
        const hasComplete = hasIndexes && indexes.every((i) => Array.isArray(i.fields))
        return {
          isValid: true,
          isFilled: hasIndexes,
          score: hasComplete ? 100 : hasIndexes ? 80 : 85,
        }
      },
    },
    {
      name: 'Campos énicos',
      path: 'fields',
      priority: FieldPriority.OPTIONAL,
      weight: 6,
      description: 'Campos com constraint de unicidade',
      validator: (value) => {
        const fields = toRecordArray(value)
        if (fields.length === 0) {
          return { isValid: true, isFilled: false, score: 90 }
        }

        const hasUnique = fields.some((f) => f.unique === true)
        return {
          isValid: true,
          isFilled: hasUnique,
          score: hasUnique ? 100 : 85,
        }
      },
    },
    {
      name: 'Valores PadrÆo',
      path: 'fields',
      priority: FieldPriority.OPTIONAL,
      weight: 5,
      description: 'Campos com valores default',
      validator: (value) => {
        const fields = toRecordArray(value)
        if (fields.length === 0) {
          return { isValid: true, isFilled: false, score: 95 }
        }

        const hasDefaults = fields.some((f) => f.default !== undefined)
        return {
          isValid: true,
          isFilled: hasDefaults,
          score: hasDefaults ? 100 : 90,
        }
      },
    },
    {
      name: 'Campos Imut veis',
      path: 'fields',
      priority: FieldPriority.OPTIONAL,
      weight: 5,
      description: 'Campos que nÆo podem ser editados ap¢s cria‡Æo',
      validator: (value, state) => {
        const operation = getString(getStateValue(state, 'operation'))
        const isUpdate = operation === 'update' || operation === 'bulk_update'

        if (!isUpdate) {
          return { isValid: true, isFilled: true, score: 100 }
        }

        const fields = toRecordArray(value)
        if (fields.length === 0) {
          return { isValid: true, isFilled: false, score: 95 }
        }

        const hasImmutable = fields.some((f) => f.immutable === true)
        return {
          isValid: true,
          isFilled: hasImmutable,
          score: hasImmutable ? 100 : 90,
        }
      },
    },
    {
      name: 'Descri‡Æo da Entidade',
      path: 'description',
      priority: FieldPriority.OPTIONAL,
      weight: 5,
      description: 'Descri‡Æo do prop¢sito da entidade',
      validator: (value) => {
        const desc = getString(value)
        return {
          isValid: true,
          isFilled: !!desc,
          score: desc ? 100 : 95,
        }
      },
    },
    {
      name: 'Nome da Tabela',
      path: 'tableName',
      priority: FieldPriority.OPTIONAL,
      weight: 5,
      description: 'Nome da tabela no banco (se diferente da entidade)',
      validator: (value) => {
        const tableName = getString(value)
        return {
          isValid: true,
          isFilled: !!tableName,
          score: tableName ? 100 : 98,
        }
      },
    },
    {
      name: 'Valida‡Æo de Campos por Tipo',
      path: 'fields',
      priority: FieldPriority.OPTIONAL,
      weight: 5,
      description: 'Campos com valida‡Æo espec¡fica definida',
      validator: (value) => {
        const fields = toRecordArray(value)
        if (fields.length === 0) {
          return { isValid: true, isFilled: false, score: 95 }
        }

        const hasValidation = fields.some((f) => f.validation)
        return {
          isValid: true,
          isFilled: hasValidation,
          score: hasValidation ? 100 : 90,
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
