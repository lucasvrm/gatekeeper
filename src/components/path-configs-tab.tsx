import { useEffect, useMemo, useState } from "react"
import { api } from "@/lib/api"
import { ConfigSection } from "@/components/config-section"
import { type ConfigModalField } from "@/components/config-modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

type PathConfigsTabProps = {
  validationConfigs?: ValidationConfigItem[]
  onUpdateConfig?: (id: string, values: Record<string, string | boolean>) => Promise<boolean>
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

const validatorCategories = ["GATE0", "GATE1", "GATE2", "TIMEOUTS"]

export function PathConfigsTab({ validationConfigs, onUpdateConfig }: PathConfigsTabProps) {
  const legacyConfig = (api as unknown as { config?: LegacyConfigApi }).config
  const [loading, setLoading] = useState(true)
  const [testPaths, setTestPaths] = useState<TestPathConvention[]>([])
  const [systemPaths, setSystemPaths] = useState<ValidationConfigItem[]>([])
  const [allValidationConfigs, setAllValidationConfigs] = useState<ValidationConfigItem[]>([])
  const [editingConfig, setEditingConfig] = useState<ValidationConfigItem | null>(null)
  const [editValue, setEditValue] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (validationConfigs) {
      setAllValidationConfigs(validationConfigs)
      setSystemPaths(validationConfigs.filter((config) => config.category === "PATHS"))
      setLoading(false)
      return
    }

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
        setAllValidationConfigs(validationConfigsData)
      } catch (error) {
        console.error("Failed to load path configs:", error)
        toast.error("Falha ao carregar configurações de path")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [validationConfigs])

  const validatorConfigs = useMemo(() => {
    return allValidationConfigs.filter((config) => validatorCategories.includes(config.category))
  }, [allValidationConfigs])

  const groupedValidatorConfigs = useMemo(() => {
    const groups: Record<string, ValidationConfigItem[]> = {}
    for (const category of validatorCategories) {
      groups[category] = []
    }
    for (const config of validatorConfigs) {
      if (!groups[config.category]) {
        groups[config.category] = []
      }
      groups[config.category].push(config)
    }
    return groups
  }, [validatorConfigs])

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

  const handleUpdateValidatorConfig = async (id: string, values: Record<string, string | boolean>) => {
    try {
      const item = allValidationConfigs.find((config) => config.id === id)
      if (!item) return false

      let updated: ValidationConfigItem | null = null
      if (onUpdateConfig) {
        const ok = await onUpdateConfig(id, values)
        if (!ok) return false
        updated = {
          ...item,
          value: String(values.value ?? item.value),
        }
      } else {
        if (api.configTables?.validationConfigs?.update) {
          updated = await api.configTables.validationConfigs.update(id, {
            key: item.key,
            value: String(values.value ?? ""),
            type: item.type,
            category: item.category,
            description: item.description ?? null,
          })
        } else if (legacyConfig?.updateValidationConfig) {
          updated = await legacyConfig.updateValidationConfig(id, {
            key: item.key,
            value: String(values.value ?? ""),
            type: item.type,
            category: item.category,
            description: item.description ?? null,
          })
        }
      }

      if (updated) {
        setAllValidationConfigs((prev) => prev.map((config) => (config.id === id ? updated! : config)))
        setSystemPaths((prev) => prev.map((config) => (config.id === id ? updated! : config)))
        toast.success("Config de validator atualizado")
        return true
      }
    } catch (error) {
      console.error("Failed to update validator config:", error)
      toast.error("Falha ao atualizar config de validator")
      return false
    }
    return false
  }

  const handleSaveValidatorConfig = async () => {
    if (!editingConfig) return
    setSaving(true)
    const ok = await handleUpdateValidatorConfig(editingConfig.id, { value: editValue })
    setSaving(false)
    if (ok) {
      setEditingConfig(null)
    }
  }

  if (loading) {
    return <div>Carregando...</div>
  }

  return (
    <Tabs defaultValue="test-conventions" className="space-y-4">
      <TabsList>
        <TabsTrigger value="test-conventions">Convenções de Test Path</TabsTrigger>
        <TabsTrigger value="system-paths">Paths do Sistema</TabsTrigger>
        <TabsTrigger value="validator-settings" data-testid="validator-settings-tab">
          Configurações de Validators
        </TabsTrigger>
      </TabsList>

      <TabsContent value="test-conventions">
        <ConfigSection
          title="Convenções de Test Path"
          description="Defina onde os arquivos de teste devem ser criados com base no tipo. Use {name} como placeholder para o nome do arquivo e {gate} para o número do gate."
          items={testPaths}
          columns={[
            { key: "testType", label: "Tipo de Teste" },
            {
              key: "pathPattern",
              label: "Padrão de Path",
              render: (item) => <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.pathPattern}</code>
            },
            {
              key: "description",
              label: "Descrição",
              render: (item) => item.description ?? "-",
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
      </TabsContent>

      <TabsContent value="system-paths">
        <Card>
          <CardHeader>
            <CardTitle>Configurações de Path do Sistema</CardTitle>
            <CardDescription>
              Paths do sistema utilizados pelo Gatekeeper. Eles devem corresponder à estrutura do seu projeto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConfigSection
              title=""
              description=""
              items={systemPaths}
              columns={[
                { key: "key", label: "Chave" },
                {
                  key: "value",
                  label: "Valor do Path",
                  render: (item) => (
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {item.value || <span className="text-muted-foreground">(vazio)</span>}
                    </code>
                  )
                },
                {
                  key: "description",
                  label: "Descrição",
                  render: (item) => item.description ?? "-",
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
        </Card>
      </TabsContent>

      <TabsContent value="validator-settings">
        <Card data-testid="validator-settings-content">
          <CardHeader>
            <CardTitle>Configurações de Validators</CardTitle>
            <CardDescription>
              Configure o comportamento dos validators, detecção de palavras-chave, padrões de ignorar e timeouts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {validatorCategories.map((category) => {
              const configs = groupedValidatorConfigs[category] || []
              return (
                <Card key={category} data-testid={`config-category-${category}`}>
                  <CardHeader>
                    <CardTitle>{category}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {configs.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Nenhum config nesta categoria.</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Chave</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {configs.map((config) => {
                            const valueParts = config.value.split(",").map((value) => value.trim()).filter(Boolean)
                            return (
                              <TableRow key={config.id} data-testid={`config-row-${config.key}`}>
                                <TableCell className="font-mono text-xs">{config.key}</TableCell>
                                <TableCell>
                                  {config.type === "STRING" && config.value.includes(",") ? (
                                    <div className="flex flex-wrap gap-1">
                                      {valueParts.map((value, index) => (
                                        <Badge
                                          key={`${config.key}-${index}`}
                                          data-testid={`config-badge-${config.key}-${index}`}
                                        >
                                          {value}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                      {config.value || <span className="text-muted-foreground">(vazio)</span>}
                                    </code>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {config.description ?? "-"}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    data-testid="edit-config-btn"
                                    onClick={() => {
                                      setEditValue(config.value)
                                      setEditingConfig(config)
                                    }}
                                  >
                                    Editar
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </CardContent>
        </Card>
      </TabsContent>

      <Dialog open={Boolean(editingConfig)} onOpenChange={(open) => !open && setEditingConfig(null)}>
        <DialogContent data-testid="edit-config-modal">
          <DialogHeader>
            <DialogTitle>Editar Config do Validator</DialogTitle>
            <DialogDescription>
              Atualize o valor para {editingConfig?.key ?? "config"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="validator-config-value">
              Valor
            </label>
            <Input
              id="validator-config-value"
              data-testid="edit-config-input"
              value={editValue}
              onChange={(event) => setEditValue(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              data-testid="save-config-btn"
              onClick={handleSaveValidatorConfig}
              disabled={saving}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  )
}
