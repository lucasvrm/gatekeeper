import { useEffect, useState } from "react"
import { usePersistedSections } from "@/hooks/use-persisted-sections"
import { api } from "@/lib/api"
import { ConfigSection } from "@/components/config-section"
import { type ConfigModalField } from "@/components/config-modal"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"
import { toast } from "sonner"

type TestPathConvention = {
  id: string
  testType: string
  pathPattern: string
  description?: string | null
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

type LegacyConfigApi = {
  getTestPathConventions?: () => Promise<TestPathConvention[]>
  getValidationConfigs?: () => Promise<ValidationConfigItem[]>
  getPathConfigs?: () => Promise<ValidationConfigItem[]>
  createTestPathConvention?: (payload: {
    testType: string
    pathPattern: string
    description?: string
    isActive?: boolean
  }) => Promise<TestPathConvention>
  updateTestPathConvention?: (testType: string, payload: Partial<{
    pathPattern: string
    description: string | null
    isActive: boolean
  }>) => Promise<TestPathConvention>
  deleteTestPathConvention?: (testType: string) => Promise<void>
  updateValidationConfig?: (id: string, payload: Partial<{
    key: string
    value: string
    type: string
    category: string
    description: string | null
  }>) => Promise<ValidationConfigItem>
}

const testPathCreateFields: ConfigModalField[] = [
  { name: "testType", label: "Tipo de Teste", type: "text", required: true },
  { name: "pathPattern", label: "Padrão de Path", type: "text", required: true },
  { name: "description", label: "Descrição", type: "textarea" },
  { name: "isActive", label: "Ativo", type: "boolean" },
]

const testPathEditFields: ConfigModalField[] = [
  { name: "pathPattern", label: "Padrão de Path", type: "text", required: true },
  { name: "description", label: "Descrição", type: "textarea" },
  { name: "isActive", label: "Ativo", type: "boolean" },
]

const systemPathEditFields: ConfigModalField[] = [
  { name: "value", label: "Valor", type: "text", required: true },
  { name: "description", label: "Descrição", type: "textarea" },
]

export function PathConfigsTab() {
  const legacyConfig = (api as unknown as { config?: LegacyConfigApi }).config
  const [loading, setLoading] = useState(true)
  const [testPaths, setTestPaths] = useState<TestPathConvention[]>([])
  const [systemPaths, setSystemPaths] = useState<ValidationConfigItem[]>([])

  const [openSections, toggleSection] = usePersistedSections("path-configs", {
    testPaths: true,
    systemPaths: true,
  })

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const [testPathsData, validationConfigsData, pathConfigsData] = await Promise.all([
          api.configTables?.testPaths?.list?.() ?? legacyConfig?.getTestPathConventions?.() ?? [],
          api.configTables?.validationConfigs?.list?.() ?? legacyConfig?.getValidationConfigs?.() ?? [],
          legacyConfig?.getPathConfigs?.() ?? [],
        ])

        setTestPaths(testPathsData)

        // Filter path-related configs
        const pathConfigsSource = pathConfigsData.length > 0 ? pathConfigsData : validationConfigsData
        const pathConfigs = pathConfigsSource.filter((config: ValidationConfigItem) =>
          config.category === 'PATHS'
        )
        setSystemPaths(pathConfigs)
      } catch (error) {
        console.error("Failed to load path configs:", error)
        toast.error("Falha ao carregar configurações de path")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Test Path Conventions handlers
  const handleCreateTestPath = async (values: Record<string, string | boolean>) => {
    try {
      const created = api.configTables?.testPaths?.create
        ? await api.configTables.testPaths.create({
          testType: String(values.testType ?? ""),
          pathPattern: String(values.pathPattern ?? ""),
          description: typeof values.description === "string" ? values.description : undefined,
          isActive: typeof values.isActive === "boolean" ? values.isActive : undefined,
        })
        : legacyConfig?.createTestPathConvention
          ? await legacyConfig.createTestPathConvention({
            testType: String(values.testType ?? ""),
            pathPattern: String(values.pathPattern ?? ""),
            description: typeof values.description === "string" ? values.description : undefined,
            isActive: typeof values.isActive === "boolean" ? values.isActive : undefined,
          })
          : null
      if (!created) {
        throw new Error("Falha ao criar convenção de test path")
      }
      setTestPaths((prev) => [created, ...prev])
      toast.success("Convenção de test path criada")
      return true
    } catch (error) {
      console.error("Failed to create test path convention:", error)
      toast.error("Falha ao criar convenção de test path")
      return false
    }
  }

  const handleUpdateTestPath = async (testType: string, values: Record<string, string | boolean>) => {
    try {
      const updated = api.configTables?.testPaths?.update
        ? await api.configTables.testPaths.update(testType, {
          pathPattern: String(values.pathPattern ?? ""),
          description: typeof values.description === "string" ? values.description : null,
          isActive: typeof values.isActive === "boolean" ? values.isActive : undefined,
        })
        : legacyConfig?.updateTestPathConvention
          ? await legacyConfig.updateTestPathConvention(testType, {
            pathPattern: String(values.pathPattern ?? ""),
            description: typeof values.description === "string" ? values.description : null,
            isActive: typeof values.isActive === "boolean" ? values.isActive : undefined,
          })
          : null
      if (!updated) {
        throw new Error("Falha ao atualizar convenção de test path")
      }
      setTestPaths((prev) => prev.map((item) => (item.testType === testType ? updated : item)))
      toast.success("Convenção de test path atualizada")
      return true
    } catch (error) {
      console.error("Failed to update test path convention:", error)
      toast.error("Falha ao atualizar convenção de test path")
      return false
    }
  }

  const handleDeleteTestPath = async (testType: string) => {
    try {
      if (api.configTables?.testPaths?.delete) {
        await api.configTables.testPaths.delete(testType)
      } else if (legacyConfig?.deleteTestPathConvention) {
        await legacyConfig.deleteTestPathConvention(testType)
      } else {
        throw new Error("Falha ao excluir convenção de test path")
      }
      setTestPaths((prev) => prev.filter((item) => item.testType !== testType))
      toast.success("Convenção de test path excluída")
      return true
    } catch (error) {
      console.error("Failed to delete test path convention:", error)
      toast.error("Falha ao excluir convenção de test path")
      return false
    }
  }

  const handleToggleTestPath = async (testType: string, isActive: boolean) => {
    try {
      const updated = api.configTables?.testPaths?.update
        ? await api.configTables.testPaths.update(testType, { isActive })
        : legacyConfig?.updateTestPathConvention
          ? await legacyConfig.updateTestPathConvention(testType, { isActive })
          : null
      if (!updated) {
        throw new Error("Falha ao atualizar convenção de test path")
      }
      setTestPaths((prev) => prev.map((item) => (item.testType === testType ? updated : item)))
      toast.success("Convenção de test path atualizada")
      return true
    } catch (error) {
      console.error("Failed to update test path convention:", error)
      toast.error("Falha ao atualizar convenção de test path")
      return false
    }
  }

  // System Path Configs handlers
  const handleUpdateSystemPath = async (id: string, values: Record<string, string | boolean>) => {
    try {
      const item = systemPaths.find((p) => p.id === id)
      if (!item) return false

      const updated = api.configTables?.validationConfigs?.update
        ? await api.configTables.validationConfigs.update(id, {
          key: item.key,
          value: String(values.value ?? ""),
          type: item.type,
          category: item.category,
          description: typeof values.description === "string" ? values.description : null,
        })
        : legacyConfig?.updateValidationConfig
          ? await legacyConfig.updateValidationConfig(id, {
            key: item.key,
            value: String(values.value ?? ""),
            type: item.type,
            category: item.category,
            description: typeof values.description === "string" ? values.description : null,
          })
          : null
      if (!updated) {
        throw new Error("Falha ao atualizar config de path do sistema")
      }
      setSystemPaths((prev) => prev.map((item) => (item.id === id ? updated : item)))
      toast.success("Config de path do sistema atualizado")
      return true
    } catch (error) {
      console.error("Failed to update system path config:", error)
      toast.error("Falha ao atualizar config de path do sistema")
      return false
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-40 bg-muted rounded animate-pulse" />
        <div className="h-40 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Test Path Conventions Section */}
      <Collapsible open={openSections.testPaths} onOpenChange={() => toggleSection('testPaths')}>
        <Card data-testid="test-path-conventions-section">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Test Path Conventions
                    <Badge variant="outline" className="text-xs">{testPaths.length}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Onde os arquivos de teste são criados por tipo.
                  </CardDescription>
                </div>
                <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openSections.testPaths ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="text-xs text-muted-foreground mb-4">
                Use <code className="bg-muted px-1 rounded">{"{name}"}</code> para nome do arquivo e <code className="bg-muted px-1 rounded">{"{gate}"}</code> para o gate.
              </div>
              <ConfigSection
                title=""
                description=""
                items={testPaths}
                columns={[
                  { key: "testType", label: "Tipo" },
                  {
                    key: "pathPattern",
                    label: "Padrão",
                    render: (item) => <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.pathPattern}</code>
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
                createFields={testPathCreateFields}
                editFields={testPathEditFields}
                createDefaults={{
                  testType: "",
                  pathPattern: "",
                  description: "",
                  isActive: true,
                }}
                getEditValues={(item) => ({
                  pathPattern: item.pathPattern,
                  description: item.description ?? "",
                  isActive: item.isActive,
                })}
                onCreate={handleCreateTestPath}
                onUpdate={(id, values) => {
                  const item = testPaths.find((p) => p.id === id)
                  if (!item) return Promise.resolve(false)
                  return handleUpdateTestPath(item.testType, values)
                }}
                onDelete={(id) => {
                  const item = testPaths.find((p) => p.id === id)
                  if (!item) return Promise.resolve(false)
                  return handleDeleteTestPath(item.testType)
                }}
                onToggle={(id, isActive) => {
                  const item = testPaths.find((p) => p.id === id)
                  if (!item) return Promise.resolve(false)
                  return handleToggleTestPath(item.testType, isActive)
                }}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* System Paths Section */}
      <Collapsible open={openSections.systemPaths} onOpenChange={() => toggleSection('systemPaths')}>
        <Card data-testid="system-paths-section">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    System Paths
                    <Badge variant="outline" className="text-xs">{systemPaths.length}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Paths do sistema utilizados pelo Gatekeeper.
                  </CardDescription>
                </div>
                <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openSections.systemPaths ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <ConfigSection
                title=""
                description=""
                items={systemPaths}
                columns={[
                  { key: "key", label: "Chave" },
                  {
                    key: "value",
                    label: "Valor",
                    render: (item) => (
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {item.value || <span className="text-muted-foreground">(vazio)</span>}
                      </code>
                    )
                  },
                ]}
                editFields={systemPathEditFields}
                getEditValues={(item) => ({
                  value: item.value,
                  description: item.description ?? "",
                })}
                onUpdate={handleUpdateSystemPath}
                hideCreate
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  )
}
