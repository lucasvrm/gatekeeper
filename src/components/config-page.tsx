import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { ConfigItem } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { Check, X } from "@phosphor-icons/react"

export function ConfigPage() {
  const [configs, setConfigs] = useState<ConfigItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingValues, setEditingValues] = useState<Record<string, string | number | boolean>>({})
  const [saving, setSaving] = useState<Set<string>>(new Set())

  useEffect(() => {
    const loadConfigs = async () => {
      setLoading(true)
      try {
        const data = await api.config.list()
        setConfigs(data)
        const initialValues: Record<string, string | number | boolean> = {}
        data.forEach((config) => {
          initialValues[config.key] = config.value
        })
        setEditingValues(initialValues)
      } catch (error) {
        console.error("Failed to load config:", error)
        toast.error("Failed to load configuration")
      } finally {
        setLoading(false)
      }
    }

    loadConfigs()
  }, [])

  const handleSave = async (config: ConfigItem) => {
    setSaving((prev) => new Set(prev).add(config.key))
    try {
      const value = editingValues[config.key]
      await api.config.update(config.key, value)
      setConfigs((prev) =>
        prev.map((c) =>
          c.key === config.key ? { ...c, value } : c
        )
      )
      toast.success(`Updated ${config.key}`)
    } catch (error) {
      console.error("Failed to update config:", error)
      toast.error(`Failed to update ${config.key}`)
    } finally {
      setSaving((prev) => {
        const next = new Set(prev)
        next.delete(config.key)
        return next
      })
    }
  }

  const hasChanged = (config: ConfigItem) => {
    return editingValues[config.key] !== config.value
  }

  const handleReset = (config: ConfigItem) => {
    setEditingValues((prev) => ({
      ...prev,
      [config.key]: config.value,
    }))
  }

  const groupedConfigs = configs.reduce((acc, config) => {
    if (!acc[config.category]) {
      acc[config.category] = []
    }
    acc[config.category].push(config)
    return acc
  }, {} as Record<string, ConfigItem[]>)

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuration</h1>
        <p className="text-muted-foreground mt-1">
          Manage system configuration settings
        </p>
      </div>

      {Object.entries(groupedConfigs).map(([category, items]) => (
        <div key={category}>
          <h2 className="text-xl font-semibold mb-4 capitalize">{category}</h2>
          <div className="space-y-3">
            {items.map((config) => {
              const changed = hasChanged(config)
              const isSaving = saving.has(config.key)

              return (
                <Card key={config.id} className="p-5 bg-card border-border">
                  <div className="flex items-start gap-6">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold font-mono text-sm">{config.key}</h3>
                        <Badge variant="outline" className="text-xs">
                          {config.type}
                        </Badge>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {config.description}
                      </p>

                      <div className="flex items-center gap-3">
                        {config.type === "BOOLEAN" ? (
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={config.key}
                              checked={editingValues[config.key] as boolean}
                              onCheckedChange={(checked) =>
                                setEditingValues((prev) => ({
                                  ...prev,
                                  [config.key]: checked as boolean,
                                }))
                              }
                            />
                            <label
                              htmlFor={config.key}
                              className="text-sm font-medium cursor-pointer"
                            >
                              {editingValues[config.key] ? "Enabled" : "Disabled"}
                            </label>
                          </div>
                        ) : config.type === "NUMBER" ? (
                          <Input
                            type="number"
                            value={editingValues[config.key] as number}
                            onChange={(e) =>
                              setEditingValues((prev) => ({
                                ...prev,
                                [config.key]: Number(e.target.value),
                              }))
                            }
                            className="max-w-xs"
                          />
                        ) : (
                          <Input
                            type="text"
                            value={editingValues[config.key] as string}
                            onChange={(e) =>
                              setEditingValues((prev) => ({
                                ...prev,
                                [config.key]: e.target.value,
                              }))
                            }
                            className="max-w-md"
                          />
                        )}

                        {changed && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSave(config)}
                              disabled={isSaving}
                              className="bg-primary hover:bg-primary/90"
                            >
                              <Check className="w-4 h-4 mr-1" />
                              {isSaving ? "Saving..." : "Save"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleReset(config)}
                              disabled={isSaving}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Reset
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
