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

const testPathCreateFields: ConfigModalField[] = [
  { name: "testType", label: "Test Type", type: "text", required: true },
  { name: "pathPattern", label: "Path Pattern", type: "text", required: true },
  { name: "description", label: "Description", type: "textarea" },
  { name: "isActive", label: "Active", type: "boolean" },
]

const testPathEditFields: ConfigModalField[] = [
  { name: "pathPattern", label: "Path Pattern", type: "text", required: true },
  { name: "description", label: "Description", type: "textarea" },
  { name: "isActive", label: "Active", type: "boolean" },
]

const systemPathEditFields: ConfigModalField[] = [
  { name: "value", label: "Value", type: "text", required: true },
  { name: "description", label: "Description", type: "textarea" },
]

const validatorCategories = ["GATE0", "GATE1", "GATE2", "TIMEOUTS"]

export function PathConfigsTab({ validationConfigs, onUpdateConfig }: PathConfigsTabProps) {
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
        const [testPathsData, validationConfigsData] = await Promise.all([
          api.configTables.testPaths.list(),
          api.configTables.validationConfigs.list(),
        ])

        setTestPaths(testPathsData)

        // Filter path-related configs
        const pathConfigs = validationConfigsData.filter((config: ValidationConfigItem) =>
          config.category === 'PATHS'
        )
        setSystemPaths(pathConfigs)
        setAllValidationConfigs(validationConfigsData)
      } catch (error) {
        console.error("Failed to load path configs:", error)
        toast.error("Failed to load path configurations")
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
      const created = await api.configTables.testPaths.create({
        testType: String(values.testType ?? ""),
        pathPattern: String(values.pathPattern ?? ""),
        description: typeof values.description === "string" ? values.description : undefined,
        isActive: typeof values.isActive === "boolean" ? values.isActive : undefined,
      })
      setTestPaths((prev) => [created, ...prev])
      toast.success("Test path convention created")
      return true
    } catch (error) {
      console.error("Failed to create test path convention:", error)
      toast.error("Failed to create test path convention")
      return false
    }
  }

  const handleUpdateTestPath = async (testType: string, values: Record<string, string | boolean>) => {
    try {
      const updated = await api.configTables.testPaths.update(testType, {
        pathPattern: String(values.pathPattern ?? ""),
        description: typeof values.description === "string" ? values.description : null,
        isActive: typeof values.isActive === "boolean" ? values.isActive : undefined,
      })
      setTestPaths((prev) => prev.map((item) => (item.testType === testType ? updated : item)))
      toast.success("Test path convention updated")
      return true
    } catch (error) {
      console.error("Failed to update test path convention:", error)
      toast.error("Failed to update test path convention")
      return false
    }
  }

  const handleDeleteTestPath = async (testType: string) => {
    try {
      await api.configTables.testPaths.delete(testType)
      setTestPaths((prev) => prev.filter((item) => item.testType !== testType))
      toast.success("Test path convention deleted")
      return true
    } catch (error) {
      console.error("Failed to delete test path convention:", error)
      toast.error("Failed to delete test path convention")
      return false
    }
  }

  const handleToggleTestPath = async (testType: string, isActive: boolean) => {
    try {
      const updated = await api.configTables.testPaths.update(testType, { isActive })
      setTestPaths((prev) => prev.map((item) => (item.testType === testType ? updated : item)))
      toast.success("Test path convention updated")
      return true
    } catch (error) {
      console.error("Failed to update test path convention:", error)
      toast.error("Failed to update test path convention")
      return false
    }
  }

  // System Path Configs handlers
  const handleUpdateSystemPath = async (id: string, values: Record<string, string | boolean>) => {
    try {
      const item = systemPaths.find((p) => p.id === id)
      if (!item) return false

      const updated = await api.configTables.validationConfigs.update(id, {
        key: item.key,
        value: String(values.value ?? ""),
        type: item.type,
        category: item.category,
        description: typeof values.description === "string" ? values.description : null,
      })
      setSystemPaths((prev) => prev.map((item) => (item.id === id ? updated : item)))
      toast.success("System path config updated")
      return true
    } catch (error) {
      console.error("Failed to update system path config:", error)
      toast.error("Failed to update system path config")
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
        updated = await api.configTables.validationConfigs.update(id, {
          key: item.key,
          value: String(values.value ?? ""),
          type: item.type,
          category: item.category,
          description: item.description ?? null,
        })
      }

      if (updated) {
        setAllValidationConfigs((prev) => prev.map((config) => (config.id === id ? updated! : config)))
        setSystemPaths((prev) => prev.map((config) => (config.id === id ? updated! : config)))
        toast.success("Validator config updated")
        return true
      }
    } catch (error) {
      console.error("Failed to update validator config:", error)
      toast.error("Failed to update validator config")
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
    return <div>Loading...</div>
  }

  return (
    <Tabs defaultValue="test-conventions" className="space-y-4">
      <TabsList>
        <TabsTrigger value="test-conventions">Test Path Conventions</TabsTrigger>
        <TabsTrigger value="system-paths">System Paths</TabsTrigger>
        <TabsTrigger value="validator-settings" data-testid="validator-settings-tab">
          Validator Settings
        </TabsTrigger>
      </TabsList>

      <TabsContent value="test-conventions">
        <ConfigSection
          title="Test Path Conventions"
          description="Define where test files should be created based on their type. Use {name} as a placeholder for the file name and {gate} for gate number."
          items={testPaths}
          columns={[
            { key: "testType", label: "Test Type" },
            {
              key: "pathPattern",
              label: "Path Pattern",
              render: (item) => <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.pathPattern}</code>
            },
            {
              key: "description",
              label: "Description",
              render: (item) => item.description ?? "-",
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
            <CardTitle>System Path Configurations</CardTitle>
            <CardDescription>
              Core system paths used by Gatekeeper. These should match your project structure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConfigSection
              title=""
              description=""
              items={systemPaths}
              columns={[
                { key: "key", label: "Config Key" },
                {
                  key: "value",
                  label: "Path Value",
                  render: (item) => (
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {item.value || <span className="text-muted-foreground">(empty)</span>}
                    </code>
                  )
                },
                {
                  key: "description",
                  label: "Description",
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
            <CardTitle>Validator Settings</CardTitle>
            <CardDescription>
              Configure validator behavior, keyword detection, ignore patterns, and timeouts.
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
                      <div className="text-sm text-muted-foreground">No configs in this category.</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Key</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Actions</TableHead>
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
                                      {config.value || <span className="text-muted-foreground">(empty)</span>}
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
                                    Edit
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
            <DialogTitle>Edit Validator Config</DialogTitle>
            <DialogDescription>
              Update the value for {editingConfig?.key ?? "config"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="validator-config-value">
              Value
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
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  )
}
