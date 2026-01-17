// ============================================================================
// FEATURE COMPLETENESS RULES
// ============================================================================
// Baseado em: FeatureContract.json + FEATURE.md + FEATURE.json

import { FieldDefinition, FieldPriority, ICompletenessRules } from '../types.js'
import { TaskType } from '../../types/elicitor.types.js'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toRecordArray = (value: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(isRecord)
}

const getString = (value: unknown): string => (typeof value === 'string' ? value : '')

export class FeatureRules implements ICompletenessRules {
  readonly taskType = TaskType.FEATURE
  readonly minScoreToGenerate = 70
  readonly minScoreComplete = 90

  readonly fields: FieldDefinition[] = [
    // ========================================================================
    // CRITICAL FIELDS (peso 10)
    // ========================================================================
    {
      name: 'Nome da Feature',
      path: 'name',
      priority: FieldPriority.CRITICAL,
      weight: 10,
      description: 'Nome descritivo da funcionalidade',
      validator: (value) => {
        const name = getString(value)
        const isValid = !!name && name.length >= 5
        return {
          isValid,
          isFilled: !!name,
          score: isValid ? 100 : name ? 60 : 0,
          message: !name ? 'Nome da feature ‚ obrigat¢rio' : 'Nome muito curto (m¡nimo 5 caracteres)',
        }
      },
    },
    {
      name: 'User Story - Quem',
      path: 'userStory.as',
      priority: FieldPriority.CRITICAL,
      weight: 10,
      description: 'Tipo de usu rio (Como [tipo de usu rio])',
      validator: (value) => {
        const actor = getString(value)
        const isValid = !!actor && actor.length >= 3
        return {
          isValid,
          isFilled: !!actor,
          score: isValid ? 100 : actor ? 60 : 0,
          message: !actor ? 'Defina quem vai usar a feature' : 'Descri‡Æo muito curta',
        }
      },
    },
    {
      name: 'User Story - O Que',
      path: 'userStory.iWant',
      priority: FieldPriority.CRITICAL,
      weight: 10,
      description: 'O que o usu rio quer fazer (Eu quero [a‡Æo])',
      validator: (value) => {
        const iWant = getString(value)
        const isValid = !!iWant && iWant.length >= 10
        return {
          isValid,
          isFilled: !!iWant,
          score: isValid ? 100 : iWant ? 60 : 0,
          message: !iWant ? 'Defina o que o usu rio quer fazer' : 'Descri‡Æo muito curta (m¡nimo 10 caracteres)',
        }
      },
    },
    {
      name: 'User Story - Por Que',
      path: 'userStory.soThat',
      priority: FieldPriority.CRITICAL,
      weight: 10,
      description: 'Benef¡cio/razÆo (Para que [benef¡cio])',
      validator: (value) => {
        const soThat = getString(value)
        const isValid = !!soThat && soThat.length >= 10
        return {
          isValid,
          isFilled: !!soThat,
          score: isValid ? 100 : soThat ? 60 : 0,
          message: !soThat ? 'Defina o benef¡cio da feature' : 'Descri‡Æo muito curta (m¡nimo 10 caracteres)',
        }
      },
    },
    {
      name: 'Happy Path',
      path: 'happyPath',
      priority: FieldPriority.CRITICAL,
      weight: 10,
      description: 'Fluxo principal com pelo menos 2 passos',
      validator: (value) => {
        const steps = toRecordArray(value)
        const hasSteps = steps.length >= 2
        const hasComplete = hasSteps && steps.every((s) => Boolean(s.step) && Boolean(s.actor) && Boolean(s.action) && Boolean(s.result))
        return {
          isValid: hasComplete,
          isFilled: hasSteps,
          score: hasComplete ? 100 : hasSteps ? 60 : 0,
          message: !hasSteps
            ? 'Defina o fluxo principal (m¡nimo 2 passos)'
            : 'Passos precisam de: step, actor, action, result',
        }
      },
    },

    // ========================================================================
    // IMPORTANT FIELDS (peso 8-9)
    // ========================================================================
    {
      name: 'Pontos de Entrada',
      path: 'entryPoints',
      priority: FieldPriority.IMPORTANT,
      weight: 9,
      description: 'De onde o usu rio inicia o fluxo',
      validator: (value) => {
        const entries = toRecordArray(value)
        const hasEntries = entries.length > 0
        const hasComplete = hasEntries && entries.every((e) => Boolean(e.location) && Boolean(e.trigger))
        return {
          isValid: hasComplete,
          isFilled: hasEntries,
          score: hasComplete ? 100 : hasEntries ? 60 : 0,
          message: !hasEntries ? 'Defina onde o usu rio come‡a' : 'Entry points precisam de location e trigger',
        }
      },
    },
    {
      name: 'Pontos de Sa¡da',
      path: 'exitPoints',
      priority: FieldPriority.IMPORTANT,
      weight: 9,
      description: 'Para onde o usu rio vai ap¢s completar/cancelar',
      validator: (value) => {
        const exits = toRecordArray(value)
        const hasExits = exits.length > 0
        const hasComplete = hasExits && exits.every((e) => Boolean(e.type) && Boolean(e.destination))
        return {
          isValid: hasComplete,
          isFilled: hasExits,
          score: hasComplete ? 100 : hasExits ? 60 : 0,
          message: !hasExits ? 'Defina onde o usu rio termina' : 'Exit points precisam de type e destination',
        }
      },
    },
    {
      name: 'Fluxos Alternativos',
      path: 'alternativePaths',
      priority: FieldPriority.IMPORTANT,
      weight: 8,
      description: 'Fluxos de erro ou alternativos',
      validator: (value) => {
        const alts = toRecordArray(value)
        const hasAlts = alts.length > 0
        const hasComplete = hasAlts && alts.every((a) => Boolean(a.name) && Boolean(a.trigger) && Array.isArray(a.steps))
        return {
          isValid: hasComplete,
          isFilled: hasAlts,
          score: hasComplete ? 100 : hasAlts ? 60 : 0,
          message: !hasAlts ? 'Defina o que pode dar errado' : 'Fluxos alternativos precisam de name, trigger e steps',
        }
      },
    },
    {
      name: 'Crit‚rios de Aceite',
      path: 'acceptanceCriteria',
      priority: FieldPriority.IMPORTANT,
      weight: 8,
      description: 'Como validar que a feature est  completa',
      validator: (value) => {
        const criteria = toRecordArray(value)
        const hasCriteria = criteria.length >= 2
        return {
          isValid: hasCriteria,
          isFilled: hasCriteria,
          score: hasCriteria ? 100 : 0,
          message: !hasCriteria ? 'Defina crit‚rios de aceite (m¡nimo 2)' : undefined,
        }
      },
    },

    // ========================================================================
    // OPTIONAL FIELDS (peso 5-7)
    // ========================================================================
    {
      name: 'Regras de Neg¢cio',
      path: 'businessRules',
      priority: FieldPriority.OPTIONAL,
      weight: 7,
      description: 'Regras e valida‡äes de neg¢cio aplic veis',
      validator: (value) => {
        const rules = toRecordArray(value)
        const hasRules = rules.length > 0
        const hasComplete = hasRules && rules.every((r) => Boolean(r.rule))
        return {
          isValid: true,
          isFilled: hasRules,
          score: hasComplete ? 100 : hasRules ? 70 : 85,
        }
      },
    },
    {
      name: 'Componentes Envolvidos',
      path: 'components',
      priority: FieldPriority.OPTIONAL,
      weight: 6,
      description: 'Componentes de UI utilizados no fluxo',
      validator: (value) => {
        const components = toRecordArray(value)
        const hasComps = components.length > 0
        return {
          isValid: true,
          isFilled: hasComps,
          score: hasComps ? 100 : 85,
        }
      },
    },
    {
      name: 'Endpoints Envolvidos',
      path: 'endpoints',
      priority: FieldPriority.OPTIONAL,
      weight: 6,
      description: 'APIs/endpoints utilizados no fluxo',
      validator: (value) => {
        const endpoints = toRecordArray(value)
        const hasEndpoints = endpoints.length > 0
        return {
          isValid: true,
          isFilled: hasEndpoints,
          score: hasEndpoints ? 100 : 85,
        }
      },
    },
    {
      name: 'Integra‡äes Externas',
      path: 'integrations',
      priority: FieldPriority.OPTIONAL,
      weight: 6,
      description: 'Sistemas externos integrados',
      validator: (value) => {
        const integrations = toRecordArray(value)
        const hasInteg = integrations.length > 0
        const hasComplete = hasInteg && integrations.every((i) => Boolean(i.system) && Boolean(i.action))
        return {
          isValid: true,
          isFilled: hasInteg,
          score: hasComplete ? 100 : hasInteg ? 80 : 90,
        }
      },
    },
    {
      name: 'Descri‡Æo',
      path: 'description',
      priority: FieldPriority.OPTIONAL,
      weight: 5,
      description: 'Descri‡Æo breve adicional da feature',
      validator: (value) => {
        const desc = getString(value)
        const hasDef = desc.length >= 20
        return {
          isValid: true,
          isFilled: !!desc,
          score: hasDef ? 100 : desc ? 80 : 90,
        }
      },
    },
    {
      name: 'Epic/M¢dulo',
      path: 'epic',
      priority: FieldPriority.OPTIONAL,
      weight: 5,
      description: 'A qual epic ou m¢dulo pertence',
      validator: (value) => {
        const epic = getString(value)
        return {
          isValid: true,
          isFilled: !!epic,
          score: epic ? 100 : 90,
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
