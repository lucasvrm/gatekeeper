import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { ConfigSection } from "@/components/config-section"
import { type ConfigModalField } from "@/components/config-modal"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

export function PathConfigsTab() {
  const [loading, setLoading] = useState(true)
  const [testPaths, setTestPaths] = useState<TestPathConvention[]>([])
  const [systemPaths, setSystemPaths] = useState<ValidationConfigItem[]>([])

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const [testPathsData, validationConfigs] = await Promise.all([
          api.configTables.testPaths.list(),
          api.configTables.validationConfigs.list(),
        ])

        setTestPaths(testPathsData)

        // Filter path-related configs
        const pathConfigs = validationConfigs.filter((config: ValidationConfigItem) =>
          config.category === 'PATHS'
        )
        setSystemPaths(pathConfigs)
      } catch (error) {
        console.error("Failed to load path configs:", error)
        toast.error("Failed to load path configurations")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

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

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <Tabs defaultValue="test-conventions" className="space-y-4">
      <TabsList>
        <TabsTrigger value="test-conventions">Test Path Conventions</TabsTrigger>
        <TabsTrigger value="system-paths">System Paths</TabsTrigger>
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
    </Tabs>
  )
}
