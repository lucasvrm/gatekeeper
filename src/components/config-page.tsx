import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { ConfigSection } from "@/components/config-section"
import { ValidatorsTab } from "@/components/validators-tab"
import { PathConfigsTab } from "@/components/path-configs-tab"
import { ValidationConfigsTab } from "@/components/validation-configs-tab"
import { type ConfigModalField } from "@/components/config-modal"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import type { FailMode } from "@/lib/types"

type SensitiveFileRule = {
  id: string
  pattern: string
  category: string
  severity: string
  description?: string | null
  isActive: boolean
}

type AmbiguousTerm = {
  id: string
  term: string
  category: string
  suggestion?: string | null
  isActive: boolean
}

type ValidationConfigItem = {
  id: string
  key: string
  value: string
  type: string
  category: string
  description?: string | null
}

type ValidatorConfigItem = {
  key: string
  value: string
  failMode?: FailMode
  category?: string
  gateCategory?: string
  displayName?: string
  description?: string
}

type LegacyConfigApi = {
  getValidators?: () => Promise<ValidatorConfigItem[]>
  updateValidator?: (name: string, payload: { isActive?: boolean; failMode?: FailMode }) => Promise<ValidatorConfigItem>
  updateFailMode?: (validatorKey: string, mode: FailMode) => Promise<ValidatorConfigItem>
  updateValidators?: (payload: { keys: string[]; updates: { isActive?: boolean; failMode?: FailMode } }) => Promise<ValidatorConfigItem[]>
  getSensitiveFileRules?: () => Promise<SensitiveFileRule[]>
  createSensitiveFileRule?: (payload: {
    pattern: string
    category: string
    severity: string
    description?: string
    isActive?: boolean
  }) => Promise<SensitiveFileRule>
  updateSensitiveFileRule?: (id: string, payload: Partial<{
    pattern: string
    category: string
    severity: string
    description: string | null
    isActive: boolean
  }>) => Promise<SensitiveFileRule>
  deleteSensitiveFileRule?: (id: string) => Promise<void>
  getAmbiguousTerms?: () => Promise<AmbiguousTerm[]>
  createAmbiguousTerm?: (payload: {
    term: string
    category: string
    suggestion?: string
    isActive?: boolean
  }) => Promise<AmbiguousTerm>
  updateAmbiguousTerm?: (id: string, payload: Partial<{
    term: string
    category: string
    suggestion: string | null
    isActive: boolean
  }>) => Promise<AmbiguousTerm>
  deleteAmbiguousTerm?: (id: string) => Promise<void>
  getValidationConfigs?: () => Promise<ValidationConfigItem[]>
  createValidationConfig?: (payload: {
    key: string
    value: string
    type: string
    category: string
    description?: string
  }) => Promise<ValidationConfigItem>
  updateValidationConfig?: (id: string, payload: Partial<{
    key: string
    value: string
    type: string
    category: string
    description: string | null
  }>) => Promise<ValidationConfigItem>
  deleteValidationConfig?: (id: string) => Promise<void>
}

const sensitiveCreateFields: ConfigModalField[] = [
  { name: "pattern", label: "Pattern", type: "text", required: true },
  { name: "category", label: "Categoria", type: "text", required: true },
  { name: "severity", label: "Severidade", type: "text", required: true },
  { name: "description", label: "Descrição", type: "textarea" },
  { name: "isActive", label: "Ativo", type: "boolean" },
]

const sensitiveEditFields = sensitiveCreateFields

const ambiguousCreateFields: ConfigModalField[] = [
  { name: "term", label: "Termo", type: "text", required: true },
  { name: "category", label: "Categoria", type: "text", required: true },
  { name: "suggestion", label: "Sugestão", type: "textarea" },
  { name: "isActive", label: "Ativo", type: "boolean" },
]

const ambiguousEditFields = ambiguousCreateFields

export function ConfigPage() {
  const legacyConfig = (api as unknown as { config?: LegacyConfigApi }).config
  const [loading, setLoading] = useState(true)
  const [validators, setValidators] = useState<ValidatorConfigItem[]>([])
  const [sensitiveRules, setSensitiveRules] = useState<SensitiveFileRule[]>([])
  const [ambiguousTerms, setAmbiguousTerms] = useState<AmbiguousTerm[]>([])
  const [validationConfigs, setValidationConfigs] = useState<ValidationConfigItem[]>([])
  const [validatorActionId, setValidatorActionId] = useState<string | null>(null)

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      try {
        const [validatorList, rules, terms, configs] = await Promise.all([
          api.validators?.list?.() ?? legacyConfig?.getValidators?.() ?? [],
          api.configTables?.sensitiveFileRules?.list?.() ?? legacyConfig?.getSensitiveFileRules?.() ?? [],
          api.configTables?.ambiguousTerms?.list?.() ?? legacyConfig?.getAmbiguousTerms?.() ?? [],
          api.configTables?.validationConfigs?.list?.() ?? legacyConfig?.getValidationConfigs?.() ?? [],
        ])
        setValidators(validatorList)
        setSensitiveRules(rules)
        setAmbiguousTerms(terms)
        setValidationConfigs(configs)
      } catch (error) {
        console.error("Failed to load config data:", error)
        toast.error("Falha ao carregar dados de configuração")
      } finally {
        setLoading(false)
      }
    }

    loadAll()
  }, [])

  const handleToggleValidator = async (name: string, isActive: boolean) => {
    setValidatorActionId(name)
    try {
      const updated = api.validators?.update
        ? await api.validators.update(name, { isActive })
        : legacyConfig?.updateValidator
          ? await legacyConfig.updateValidator(name, { isActive })
          : null
      if (!updated) {
        throw new Error("Falha ao atualizar validator")
      }
      setValidators((prev) => prev.map((item) => (item.key === name ? updated : item)))
      toast.success("Validator atualizado")
    } catch (error) {
      console.error("Failed to update validator:", error)
      toast.error("Falha ao atualizar validator")
    } finally {
      setValidatorActionId(null)
    }
  }

  const handleFailModeChange = async (validatorKey: string, mode: FailMode) => {
    setValidatorActionId(validatorKey)
    try {
      const updated = api.validators?.update
        ? await api.validators.update(validatorKey, { failMode: mode })
        : legacyConfig?.updateFailMode
          ? await legacyConfig.updateFailMode(validatorKey, mode)
          : null
      if (!updated) {
        throw new Error("Falha ao atualizar fail mode")
      }
      setValidators((prev) => prev.map((item) => (item.key === validatorKey ? updated : item)))
      toast.success("Fail mode atualizado")
    } catch (error) {
      console.error("Failed to update fail mode:", error)
      toast.error("Falha ao atualizar fail mode")
    } finally {
      setValidatorActionId(null)
    }
  }

  const handleBulkUpdateValidators = async (payload: {
    keys: string[]
    updates: { isActive?: boolean; failMode?: FailMode }
  }) => {
    try {
      const updated = api.validators?.bulkUpdate
        ? await api.validators.bulkUpdate(payload)
        : legacyConfig?.updateValidators
          ? await legacyConfig.updateValidators(payload)
          : null
      if (!updated) {
        throw new Error("Falha ao atualizar validators")
      }
      const updatedMap = new Map(updated.map((item) => [item.key, item]))
      setValidators((prev) =>
        prev.map((item) => {
          const replacement = updatedMap.get(item.key)
          return replacement ? { ...item, value: replacement.value, failMode: replacement.failMode } : item
        })
      )
      toast.success("Validators atualizados")
      return updated
    } catch (error) {
      console.error("Failed to bulk update validators:", error)
      const message = error instanceof Error ? error.message : "Falha ao atualizar validators"
      toast.error(message)
      throw error
    }
  }

  const activeValidators = validators.filter((validator) => validator.value === "true").length
  const inactiveValidators = validators.length - activeValidators

  const handleCreateSensitive = async (values: Record<string, string | boolean>) => {
    try {
      const created = api.configTables?.sensitiveFileRules?.create
        ? await api.configTables.sensitiveFileRules.create({
          pattern: String(values.pattern ?? ""),
          category: String(values.category ?? ""),
          severity: String(values.severity ?? ""),
          description: typeof values.description === "string" ? values.description : undefined,
          isActive: typeof values.isActive === "boolean" ? values.isActive : undefined,
        })
        : legacyConfig?.createSensitiveFileRule
          ? await legacyConfig.createSensitiveFileRule({
          pattern: String(values.pattern ?? ""),
          category: String(values.category ?? ""),
          severity: String(values.severity ?? ""),
          description: typeof values.description === "string" ? values.description : undefined,
          isActive: typeof values.isActive === "boolean" ? values.isActive : undefined,
        })
          : null
      if (!created) {
        throw new Error("Falha ao criar sensitive file rule")
      }
      setSensitiveRules((prev) => [created, ...prev])
      toast.success("Sensitive file rule criada")
      return true
    } catch (error) {
      console.error("Failed to create sensitive file rule:", error)
      toast.error("Falha ao criar sensitive file rule")
      return false
    }
  }

  const handleUpdateSensitive = async (id: string, values: Record<string, string | boolean>) => {
    try {
      const updated = api.configTables?.sensitiveFileRules?.update
        ? await api.configTables.sensitiveFileRules.update(id, {
          pattern: String(values.pattern ?? ""),
          category: String(values.category ?? ""),
          severity: String(values.severity ?? ""),
          description: typeof values.description === "string" ? values.description : null,
          isActive: typeof values.isActive === "boolean" ? values.isActive : undefined,
        })
        : legacyConfig?.updateSensitiveFileRule
          ? await legacyConfig.updateSensitiveFileRule(id, {
          pattern: String(values.pattern ?? ""),
          category: String(values.category ?? ""),
          severity: String(values.severity ?? ""),
          description: typeof values.description === "string" ? values.description : null,
          isActive: typeof values.isActive === "boolean" ? values.isActive : undefined,
        })
          : null
      if (!updated) {
        throw new Error("Falha ao atualizar sensitive file rule")
      }
      setSensitiveRules((prev) => prev.map((item) => (item.id === id ? updated : item)))
      toast.success("Sensitive file rule atualizada")
      return true
    } catch (error) {
      console.error("Failed to update sensitive file rule:", error)
      toast.error("Falha ao atualizar sensitive file rule")
      return false
    }
  }

  const handleDeleteSensitive = async (id: string) => {
    try {
      if (api.configTables?.sensitiveFileRules?.delete) {
        await api.configTables.sensitiveFileRules.delete(id)
      } else {
        await legacyConfig?.deleteSensitiveFileRule?.(id)
      }
      setSensitiveRules((prev) => prev.filter((item) => item.id !== id))
      toast.success("Sensitive file rule excluída")
      return true
    } catch (error) {
      console.error("Failed to delete sensitive file rule:", error)
      toast.error("Falha ao excluir sensitive file rule")
      return false
    }
  }

  const handleToggleSensitive = async (id: string, isActive: boolean) => {
    try {
      const updated = api.configTables?.sensitiveFileRules?.update
        ? await api.configTables.sensitiveFileRules.update(id, { isActive })
        : legacyConfig?.updateSensitiveFileRule
          ? await legacyConfig.updateSensitiveFileRule(id, { isActive })
          : null
      if (!updated) {
        throw new Error("Falha ao atualizar sensitive file rule")
      }
      setSensitiveRules((prev) => prev.map((item) => (item.id === id ? updated : item)))
      toast.success("Sensitive file rule atualizada")
      return true
    } catch (error) {
      console.error("Failed to update sensitive file rule:", error)
      toast.error("Falha ao atualizar sensitive file rule")
      return false
    }
  }

  const handleCreateAmbiguous = async (values: Record<string, string | boolean>) => {
    try {
      const created = api.configTables?.ambiguousTerms?.create
        ? await api.configTables.ambiguousTerms.create({
          term: String(values.term ?? ""),
          category: String(values.category ?? ""),
          suggestion: typeof values.suggestion === "string" ? values.suggestion : undefined,
          isActive: typeof values.isActive === "boolean" ? values.isActive : undefined,
        })
        : legacyConfig?.createAmbiguousTerm
          ? await legacyConfig.createAmbiguousTerm({
          term: String(values.term ?? ""),
          category: String(values.category ?? ""),
          suggestion: typeof values.suggestion === "string" ? values.suggestion : undefined,
          isActive: typeof values.isActive === "boolean" ? values.isActive : undefined,
        })
          : null
      if (!created) {
        throw new Error("Falha ao criar termo ambíguo")
      }
      setAmbiguousTerms((prev) => [created, ...prev])
      toast.success("Termo ambíguo criado")
      return true
    } catch (error) {
      console.error("Failed to create ambiguous term:", error)
      toast.error("Falha ao criar termo ambíguo")
      return false
    }
  }

  const handleUpdateAmbiguous = async (id: string, values: Record<string, string | boolean>) => {
    try {
      const updated = api.configTables?.ambiguousTerms?.update
        ? await api.configTables.ambiguousTerms.update(id, {
          term: String(values.term ?? ""),
          category: String(values.category ?? ""),
          suggestion: typeof values.suggestion === "string" ? values.suggestion : null,
          isActive: typeof values.isActive === "boolean" ? values.isActive : undefined,
        })
        : legacyConfig?.updateAmbiguousTerm
          ? await legacyConfig.updateAmbiguousTerm(id, {
          term: String(values.term ?? ""),
          category: String(values.category ?? ""),
          suggestion: typeof values.suggestion === "string" ? values.suggestion : null,
          isActive: typeof values.isActive === "boolean" ? values.isActive : undefined,
        })
          : null
      if (!updated) {
        throw new Error("Falha ao atualizar termo ambíguo")
      }
      setAmbiguousTerms((prev) => prev.map((item) => (item.id === id ? updated : item)))
      toast.success("Termo ambíguo atualizado")
      return true
    } catch (error) {
      console.error("Failed to update ambiguous term:", error)
      toast.error("Falha ao atualizar termo ambíguo")
      return false
    }
  }

  const handleDeleteAmbiguous = async (id: string) => {
    try {
      if (api.configTables?.ambiguousTerms?.delete) {
        await api.configTables.ambiguousTerms.delete(id)
      } else {
        await legacyConfig?.deleteAmbiguousTerm?.(id)
      }
      setAmbiguousTerms((prev) => prev.filter((item) => item.id !== id))
      toast.success("Termo ambíguo excluído")
      return true
    } catch (error) {
      console.error("Failed to delete ambiguous term:", error)
      toast.error("Falha ao excluir termo ambíguo")
      return false
    }
  }

  const handleToggleAmbiguous = async (id: string, isActive: boolean) => {
    try {
      const updated = api.configTables?.ambiguousTerms?.update
        ? await api.configTables.ambiguousTerms.update(id, { isActive })
        : legacyConfig?.updateAmbiguousTerm
          ? await legacyConfig.updateAmbiguousTerm(id, { isActive })
          : null
      if (!updated) {
        throw new Error("Falha ao atualizar termo ambíguo")
      }
      setAmbiguousTerms((prev) => prev.map((item) => (item.id === id ? updated : item)))
      toast.success("Termo ambíguo atualizado")
      return true
    } catch (error) {
      console.error("Failed to update ambiguous term:", error)
      toast.error("Falha ao atualizar termo ambíguo")
      return false
    }
  }

  const handleCreateValidation = async (values: Record<string, string | boolean>) => {
    try {
      const created = api.configTables?.validationConfigs?.create
        ? await api.configTables.validationConfigs.create({
          key: String(values.key ?? ""),
          value: String(values.value ?? ""),
          type: String(values.type ?? ""),
          category: String(values.category ?? ""),
          description: typeof values.description === "string" ? values.description : undefined,
        })
        : legacyConfig?.createValidationConfig
          ? await legacyConfig.createValidationConfig({
          key: String(values.key ?? ""),
          value: String(values.value ?? ""),
          type: String(values.type ?? ""),
          category: String(values.category ?? ""),
          description: typeof values.description === "string" ? values.description : undefined,
        })
          : null
      if (!created) {
        throw new Error("Falha ao criar validation config")
      }
      setValidationConfigs((prev) => [created, ...prev])
      toast.success("Validation config criado")
      return true
    } catch (error) {
      console.error("Failed to create validation config:", error)
      toast.error("Falha ao criar validation config")
      return false
    }
  }

  const handleUpdateValidation = async (id: string, values: Record<string, string | boolean>) => {
    try {
      const updated = api.configTables?.validationConfigs?.update
        ? await api.configTables.validationConfigs.update(id, {
          key: String(values.key ?? ""),
          value: String(values.value ?? ""),
          type: String(values.type ?? ""),
          category: String(values.category ?? ""),
          description: typeof values.description === "string" ? values.description : null,
        })
        : legacyConfig?.updateValidationConfig
          ? await legacyConfig.updateValidationConfig(id, {
          key: String(values.key ?? ""),
          value: String(values.value ?? ""),
          type: String(values.type ?? ""),
          category: String(values.category ?? ""),
          description: typeof values.description === "string" ? values.description : null,
        })
          : null
      if (!updated) {
        throw new Error("Falha ao atualizar validation config")
      }
      setValidationConfigs((prev) => prev.map((item) => (item.id === id ? updated : item)))
      toast.success("Validation config atualizado")
      return true
    } catch (error) {
      console.error("Failed to update validation config:", error)
      toast.error("Falha ao atualizar validation config")
      return false
    }
  }

  const handleDeleteValidation = async (id: string) => {
    try {
      if (api.configTables?.validationConfigs?.delete) {
        await api.configTables.validationConfigs.delete(id)
      } else {
        await legacyConfig?.deleteValidationConfig?.(id)
      }
      setValidationConfigs((prev) => prev.filter((item) => item.id !== id))
      toast.success("Validation config excluído")
      return true
    } catch (error) {
      console.error("Failed to delete validation config:", error)
      toast.error("Falha ao excluir validation config")
      return false
    }
  }

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        {[1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-40" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuração</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie sensitive file rules, termos ambíguos e configurações de validation.
        </p>
      </div>

      <Tabs defaultValue="validators" className="space-y-4">
        <TabsList>
          <TabsTrigger value="validators">Validators</TabsTrigger>
          <TabsTrigger value="validation-configs">Validation Configs</TabsTrigger>
          <TabsTrigger value="path-configs">Path Configs</TabsTrigger>
          <TabsTrigger value="sensitive-file-rules">Sensitive File Rules</TabsTrigger>
          <TabsTrigger value="ambiguous-terms">Termos Ambíguos</TabsTrigger>
        </TabsList>

        <TabsContent value="validators">
          <ValidatorsTab
            validators={validators}
            actionId={validatorActionId}
            activeCount={activeValidators}
            inactiveCount={inactiveValidators}
            onToggle={handleToggleValidator}
            onFailModeChange={handleFailModeChange}
            onBulkUpdate={handleBulkUpdateValidators}
          />
        </TabsContent>

        <TabsContent value="validation-configs">
          <ValidationConfigsTab
            items={validationConfigs}
            onCreate={handleCreateValidation}
            onUpdate={handleUpdateValidation}
            onDelete={handleDeleteValidation}
          />
        </TabsContent>

        <TabsContent value="path-configs">
          <PathConfigsTab />
        </TabsContent>

        <TabsContent value="sensitive-file-rules">
          <ConfigSection
            title="Sensitive File Rules"
            description="Padrões usados para sinalizar arquivos sensíveis."
            items={sensitiveRules}
            columns={[
              { key: "pattern", label: "Pattern" },
              { key: "category", label: "Categoria" },
              { key: "severity", label: "Severidade" },
              {
                key: "isActive",
                label: "Status",
                render: (item) => (
                  <Badge variant={item.isActive ? "default" : "secondary"}>
                    {item.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                ),
              },
            ]}
            createFields={sensitiveCreateFields}
            editFields={sensitiveEditFields}
            createDefaults={{
              pattern: "",
              category: "",
              severity: "",
              description: "",
              isActive: true,
            }}
            getEditValues={(item) => ({
              pattern: item.pattern,
              category: item.category,
              severity: item.severity,
              description: item.description ?? "",
              isActive: item.isActive,
            })}
            onCreate={handleCreateSensitive}
            onUpdate={handleUpdateSensitive}
            onDelete={handleDeleteSensitive}
            onToggle={handleToggleSensitive}
          />
        </TabsContent>

        <TabsContent value="ambiguous-terms">
          <ConfigSection
            title="Termos Ambíguos"
            description="Termos que requerem clarificação ou revisão."
            items={ambiguousTerms}
            columns={[
              { key: "term", label: "Termo" },
              { key: "category", label: "Categoria" },
              {
                key: "suggestion",
                label: "Sugestão",
                render: (item) => item.suggestion ?? "-",
              },
              {
                key: "isActive",
                label: "Status",
                render: (item) => (
                  <Badge variant={item.isActive ? "default" : "secondary"}>
                    {item.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                ),
              },
            ]}
            createFields={ambiguousCreateFields}
            editFields={ambiguousEditFields}
            createDefaults={{
              term: "",
              category: "",
              suggestion: "",
              isActive: true,
            }}
            getEditValues={(item) => ({
              term: item.term,
              category: item.category,
              suggestion: item.suggestion ?? "",
              isActive: item.isActive,
            })}
            onCreate={handleCreateAmbiguous}
            onUpdate={handleUpdateAmbiguous}
            onDelete={handleDeleteAmbiguous}
            onToggle={handleToggleAmbiguous}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
