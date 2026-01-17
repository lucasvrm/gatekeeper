import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { ConfigSection } from "@/components/config-section"
import { ValidatorsTab } from "@/components/validators-tab"
import { type ConfigModalField } from "@/components/config-modal"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"

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
}

const sensitiveCreateFields: ConfigModalField[] = [
  { name: "pattern", label: "Pattern", type: "text", required: true },
  { name: "category", label: "Category", type: "text", required: true },
  { name: "severity", label: "Severity", type: "text", required: true },
  { name: "description", label: "Description", type: "textarea" },
  { name: "isActive", label: "Active", type: "boolean" },
]

const sensitiveEditFields = sensitiveCreateFields

const ambiguousCreateFields: ConfigModalField[] = [
  { name: "term", label: "Term", type: "text", required: true },
  { name: "category", label: "Category", type: "text", required: true },
  { name: "suggestion", label: "Suggestion", type: "textarea" },
  { name: "isActive", label: "Active", type: "boolean" },
]

const ambiguousEditFields = ambiguousCreateFields

const validationCreateFields: ConfigModalField[] = [
  { name: "key", label: "Key", type: "text", required: true },
  { name: "value", label: "Value", type: "text", required: true },
  { name: "type", label: "Type", type: "text", required: true },
  { name: "category", label: "Category", type: "text", required: true },
  { name: "description", label: "Description", type: "textarea" },
]

const validationEditFields = validationCreateFields

export function ConfigPage() {
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
          api.validators.list(),
          api.configTables.sensitiveFileRules.list(),
          api.configTables.ambiguousTerms.list(),
          api.configTables.validationConfigs.list(),
        ])
        setValidators(validatorList)
        setSensitiveRules(rules)
        setAmbiguousTerms(terms)
        setValidationConfigs(configs)
      } catch (error) {
        console.error("Failed to load config data:", error)
        toast.error("Failed to load configuration data")
      } finally {
        setLoading(false)
      }
    }

    loadAll()
  }, [])

  const handleToggleValidator = async (name: string, isActive: boolean) => {
    setValidatorActionId(name)
    try {
      const updated = await api.validators.update(name, isActive)
      setValidators((prev) => prev.map((item) => (item.key === name ? updated : item)))
      toast.success("Validator updated")
    } catch (error) {
      console.error("Failed to update validator:", error)
      toast.error("Failed to update validator")
    } finally {
      setValidatorActionId(null)
    }
  }

  const activeValidators = validators.filter((validator) => validator.value === "true").length
  const inactiveValidators = validators.length - activeValidators

  const handleCreateSensitive = async (values: Record<string, string | boolean>) => {
    try {
      const created = await api.configTables.sensitiveFileRules.create({
        pattern: String(values.pattern ?? ""),
        category: String(values.category ?? ""),
        severity: String(values.severity ?? ""),
        description: typeof values.description === "string" ? values.description : undefined,
        isActive: typeof values.isActive === "boolean" ? values.isActive : undefined,
      })
      setSensitiveRules((prev) => [created, ...prev])
      toast.success("Sensitive file rule created")
      return true
    } catch (error) {
      console.error("Failed to create sensitive file rule:", error)
      toast.error("Failed to create sensitive file rule")
      return false
    }
  }

  const handleUpdateSensitive = async (id: string, values: Record<string, string | boolean>) => {
    try {
      const updated = await api.configTables.sensitiveFileRules.update(id, {
        pattern: String(values.pattern ?? ""),
        category: String(values.category ?? ""),
        severity: String(values.severity ?? ""),
        description: typeof values.description === "string" ? values.description : null,
        isActive: typeof values.isActive === "boolean" ? values.isActive : undefined,
      })
      setSensitiveRules((prev) => prev.map((item) => (item.id === id ? updated : item)))
      toast.success("Sensitive file rule updated")
      return true
    } catch (error) {
      console.error("Failed to update sensitive file rule:", error)
      toast.error("Failed to update sensitive file rule")
      return false
    }
  }

  const handleDeleteSensitive = async (id: string) => {
    try {
      await api.configTables.sensitiveFileRules.delete(id)
      setSensitiveRules((prev) => prev.filter((item) => item.id !== id))
      toast.success("Sensitive file rule deleted")
      return true
    } catch (error) {
      console.error("Failed to delete sensitive file rule:", error)
      toast.error("Failed to delete sensitive file rule")
      return false
    }
  }

  const handleToggleSensitive = async (id: string, isActive: boolean) => {
    try {
      const updated = await api.configTables.sensitiveFileRules.update(id, { isActive })
      setSensitiveRules((prev) => prev.map((item) => (item.id === id ? updated : item)))
      toast.success("Sensitive file rule updated")
      return true
    } catch (error) {
      console.error("Failed to update sensitive file rule:", error)
      toast.error("Failed to update sensitive file rule")
      return false
    }
  }

  const handleCreateAmbiguous = async (values: Record<string, string | boolean>) => {
    try {
      const created = await api.configTables.ambiguousTerms.create({
        term: String(values.term ?? ""),
        category: String(values.category ?? ""),
        suggestion: typeof values.suggestion === "string" ? values.suggestion : undefined,
        isActive: typeof values.isActive === "boolean" ? values.isActive : undefined,
      })
      setAmbiguousTerms((prev) => [created, ...prev])
      toast.success("Ambiguous term created")
      return true
    } catch (error) {
      console.error("Failed to create ambiguous term:", error)
      toast.error("Failed to create ambiguous term")
      return false
    }
  }

  const handleUpdateAmbiguous = async (id: string, values: Record<string, string | boolean>) => {
    try {
      const updated = await api.configTables.ambiguousTerms.update(id, {
        term: String(values.term ?? ""),
        category: String(values.category ?? ""),
        suggestion: typeof values.suggestion === "string" ? values.suggestion : null,
        isActive: typeof values.isActive === "boolean" ? values.isActive : undefined,
      })
      setAmbiguousTerms((prev) => prev.map((item) => (item.id === id ? updated : item)))
      toast.success("Ambiguous term updated")
      return true
    } catch (error) {
      console.error("Failed to update ambiguous term:", error)
      toast.error("Failed to update ambiguous term")
      return false
    }
  }

  const handleDeleteAmbiguous = async (id: string) => {
    try {
      await api.configTables.ambiguousTerms.delete(id)
      setAmbiguousTerms((prev) => prev.filter((item) => item.id !== id))
      toast.success("Ambiguous term deleted")
      return true
    } catch (error) {
      console.error("Failed to delete ambiguous term:", error)
      toast.error("Failed to delete ambiguous term")
      return false
    }
  }

  const handleToggleAmbiguous = async (id: string, isActive: boolean) => {
    try {
      const updated = await api.configTables.ambiguousTerms.update(id, { isActive })
      setAmbiguousTerms((prev) => prev.map((item) => (item.id === id ? updated : item)))
      toast.success("Ambiguous term updated")
      return true
    } catch (error) {
      console.error("Failed to update ambiguous term:", error)
      toast.error("Failed to update ambiguous term")
      return false
    }
  }

  const handleCreateValidation = async (values: Record<string, string | boolean>) => {
    try {
      const created = await api.configTables.validationConfigs.create({
        key: String(values.key ?? ""),
        value: String(values.value ?? ""),
        type: String(values.type ?? ""),
        category: String(values.category ?? ""),
        description: typeof values.description === "string" ? values.description : undefined,
      })
      setValidationConfigs((prev) => [created, ...prev])
      toast.success("Validation config created")
      return true
    } catch (error) {
      console.error("Failed to create validation config:", error)
      toast.error("Failed to create validation config")
      return false
    }
  }

  const handleUpdateValidation = async (id: string, values: Record<string, string | boolean>) => {
    try {
      const updated = await api.configTables.validationConfigs.update(id, {
        key: String(values.key ?? ""),
        value: String(values.value ?? ""),
        type: String(values.type ?? ""),
        category: String(values.category ?? ""),
        description: typeof values.description === "string" ? values.description : null,
      })
      setValidationConfigs((prev) => prev.map((item) => (item.id === id ? updated : item)))
      toast.success("Validation config updated")
      return true
    } catch (error) {
      console.error("Failed to update validation config:", error)
      toast.error("Failed to update validation config")
      return false
    }
  }

  const handleDeleteValidation = async (id: string) => {
    try {
      await api.configTables.validationConfigs.delete(id)
      setValidationConfigs((prev) => prev.filter((item) => item.id !== id))
      toast.success("Validation config deleted")
      return true
    } catch (error) {
      console.error("Failed to delete validation config:", error)
      toast.error("Failed to delete validation config")
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
        <h1 className="text-3xl font-bold tracking-tight">Configuration</h1>
        <p className="text-muted-foreground mt-1">
          Manage sensitive rules, ambiguous terms, and validation settings.
        </p>
      </div>

      <Tabs defaultValue="validators" className="space-y-4">
        <TabsList>
          <TabsTrigger value="validators">Validators</TabsTrigger>
          <TabsTrigger value="sensitive-file-rules">Sensitive File Rules</TabsTrigger>
          <TabsTrigger value="ambiguous-terms">Ambiguous Terms</TabsTrigger>
          <TabsTrigger value="validation-configs">Validation Configs</TabsTrigger>
        </TabsList>

        <TabsContent value="validators">
          <ValidatorsTab
            validators={validators}
            actionId={validatorActionId}
            activeCount={activeValidators}
            inactiveCount={inactiveValidators}
            onToggle={handleToggleValidator}
          />
        </TabsContent>

        <TabsContent value="sensitive-file-rules">
          <ConfigSection
            title="Sensitive File Rules"
            description="Patterns used to flag sensitive files."
            items={sensitiveRules}
            columns={[
              { key: "pattern", label: "Pattern" },
              { key: "category", label: "Category" },
              { key: "severity", label: "Severity" },
              {
                key: "isActive",
                label: "Status",
                render: (item) => (
                  <Badge variant={item.isActive ? "default" : "secondary"}>
                    {item.isActive ? "Active" : "Inactive"}
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
            title="Ambiguous Terms"
            description="Terms that require clarification or review."
            items={ambiguousTerms}
            columns={[
              { key: "term", label: "Term" },
              { key: "category", label: "Category" },
              {
                key: "suggestion",
                label: "Suggestion",
                render: (item) => item.suggestion ?? "-",
              },
              {
                key: "isActive",
                label: "Status",
                render: (item) => (
                  <Badge variant={item.isActive ? "default" : "secondary"}>
                    {item.isActive ? "Active" : "Inactive"}
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

        <TabsContent value="validation-configs">
          <ConfigSection
            title="Validation Configs"
            description="Config values used by validation checks."
            items={validationConfigs}
            columns={[
              { key: "key", label: "Key" },
              { key: "value", label: "Value" },
              { key: "type", label: "Type" },
              { key: "category", label: "Category" },
            ]}
            createFields={validationCreateFields}
            editFields={validationEditFields}
            createDefaults={{
              key: "",
              value: "",
              type: "",
              category: "",
              description: "",
            }}
            getEditValues={(item) => ({
              key: item.key,
              value: item.value,
              type: item.type,
              category: item.category,
              description: item.description ?? "",
            })}
            onCreate={handleCreateValidation}
            onUpdate={handleUpdateValidation}
            onDelete={handleDeleteValidation}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
