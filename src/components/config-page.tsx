import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { api } from "@/lib/api"
import { ValidatorsTab } from "@/components/validators-tab"
import { PathConfigsTab } from "@/components/path-configs-tab"
import { SecurityRulesTab } from "@/components/security-rules-tab"
import { AdvancedTab } from "@/components/advanced-tab"
import { PromptsTab } from "@/components/prompts-tab"
import { AgentsTab } from "@/components/agents-tab"
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
  updateValidationConfig?: (id: string, payload: Partial<{
    key: string
    value: string
    type: string
    category: string
    description: string | null
  }>) => Promise<ValidationConfigItem>
}

const VALID_TABS = ["validators", "security-rules", "conventions", "prompts", "agents", "advanced"] as const

export function ConfigPage() {
  const legacyConfig = (api as unknown as { config?: LegacyConfigApi }).config
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get("tab")
  const activeTab = VALID_TABS.includes(tabParam as any) ? tabParam! : "validators"
  const [loading, setLoading] = useState(true)
  const [validators, setValidators] = useState<ValidatorConfigItem[]>([])
  const [sensitiveRules, setSensitiveRules] = useState<SensitiveFileRule[]>([])
  const [ambiguousTerms, setAmbiguousTerms] = useState<AmbiguousTerm[]>([])
  const [validationConfigs, setValidationConfigs] = useState<ValidationConfigItem[]>([])

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
    }
  }

  const handleFailModeChange = async (validatorKey: string, mode: FailMode) => {
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
    }
  }

  const handleBulkFailModeChange = async (keys: string[], mode: FailMode) => {
    try {
      const updated = await api.validators.bulkUpdate({ keys, updates: { failMode: mode } })
      if (!updated) throw new Error("Falha ao atualizar validators")
      const updatedMap = new Map(updated.map((item: ValidatorConfigItem) => [item.key, item]))
      setValidators((prev) => prev.map((item) => {
        const u = updatedMap.get(item.key)
        return u ? { ...item, ...u } : item
      }))
      toast.success(`${keys.length} validators atualizados para ${mode}`)
    } catch (error) {
      console.error("Failed to bulk update validators:", error)
      toast.error("Falha ao atualizar validators em massa")
    }
  }

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

  const handleUpdateValidationConfigValue = async (id: string, value: string) => {
    try {
      const updated = api.configTables?.validationConfigs?.update
        ? await api.configTables.validationConfigs.update(id, { value })
        : legacyConfig?.updateValidationConfig
          ? await legacyConfig.updateValidationConfig(id, { value })
          : null
      if (!updated) {
        throw new Error("Falha ao atualizar validation config")
      }
      setValidationConfigs((prev) => prev.map((item) => (item.id === id ? updated : item)))
    } catch (error) {
      console.error("Failed to update validation config:", error)
      throw error
    }
  }

  // Wrappers for SecurityRulesTab
  const handleCreateSensitiveRule = async (data: Partial<SensitiveFileRule>) => {
    await handleCreateSensitive({
      pattern: data.pattern ?? "",
      category: data.category ?? "",
      severity: data.severity ?? "",
      description: data.description ?? "",
      isActive: data.isActive ?? true,
    })
  }

  const handleUpdateSensitiveRule = async (id: string, data: Partial<SensitiveFileRule>) => {
    await handleUpdateSensitive(id, {
      pattern: data.pattern ?? "",
      category: data.category ?? "",
      severity: data.severity ?? "",
      description: data.description ?? "",
      isActive: data.isActive,
    })
  }

  const handleDeleteSensitiveRule = async (id: string) => {
    await handleDeleteSensitive(id)
  }

  const handleCreateAmbiguousTermRule = async (data: Partial<AmbiguousTerm>) => {
    await handleCreateAmbiguous({
      term: data.term ?? "",
      category: data.category ?? "",
      suggestion: data.suggestion ?? "",
      isActive: data.isActive ?? true,
    })
  }

  const handleUpdateAmbiguousTermRule = async (id: string, data: Partial<AmbiguousTerm>) => {
    await handleUpdateAmbiguous(id, {
      term: data.term ?? "",
      category: data.category ?? "",
      suggestion: data.suggestion ?? "",
      isActive: data.isActive,
    })
  }

  const handleDeleteAmbiguousTermRule = async (id: string) => {
    await handleDeleteAmbiguous(id)
  }

  if (loading) {
    return (
      <div className="page-gap">
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
    <div className="page-gap">

      <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })} className="space-y-4">
        <TabsList>
          <TabsTrigger value="validators">Validators</TabsTrigger>
          <TabsTrigger value="security-rules">Security Rules</TabsTrigger>
          <TabsTrigger value="conventions">Conventions</TabsTrigger>
          <TabsTrigger value="prompts">LLM Prompts</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="validators">
          <ValidatorsTab
            validators={validators}
            validationConfigs={validationConfigs}
            onToggle={handleToggleValidator}
            onFailModeChange={handleFailModeChange}
            onBulkFailModeChange={handleBulkFailModeChange}
            onUpdateConfig={handleUpdateValidationConfigValue}
          />
        </TabsContent>

        <TabsContent value="security-rules">
          <SecurityRulesTab
            sensitiveFileRules={sensitiveRules}
            ambiguousTerms={ambiguousTerms}
            onCreateSensitiveRule={handleCreateSensitiveRule}
            onUpdateSensitiveRule={handleUpdateSensitiveRule}
            onDeleteSensitiveRule={handleDeleteSensitiveRule}
            onCreateAmbiguousTerm={handleCreateAmbiguousTermRule}
            onUpdateAmbiguousTerm={handleUpdateAmbiguousTermRule}
            onDeleteAmbiguousTerm={handleDeleteAmbiguousTermRule}
          />
        </TabsContent>

        <TabsContent value="conventions">
          <PathConfigsTab />
        </TabsContent>

        <TabsContent value="prompts">
          <PromptsTab />
        </TabsContent>

        <TabsContent value="agents">
          <AgentsTab />
        </TabsContent>

        <TabsContent value="advanced">
          <AdvancedTab
            validationConfigs={validationConfigs}
            onUpdateConfig={handleUpdateValidationConfigValue}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
