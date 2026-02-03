import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

interface ValidationConfigItem {
  id: string
  key: string
  value: string
  type: string
  category: string
  description?: string | null
}

interface ValidatorConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  validatorCode: string
  validatorDisplayName: string
  configs: ValidationConfigItem[]
  onSave: (id: string, value: string) => Promise<void>
}

function getInputType(config: ValidationConfigItem): "switch" | "number" | "tags" | "text" {
  if (config.type === "BOOLEAN") return "switch"
  if (config.type === "NUMBER") return "number"
  if (config.type === "STRING" && config.value.includes(",")) return "tags"
  return "text"
}

interface TagInputProps {
  value: string
  onChange: (value: string) => void
}

function TagInput({ value, onChange }: TagInputProps) {
  const [inputValue, setInputValue] = useState("")

  const tags = useMemo(() =>
    value.split(",").map(t => t.trim()).filter(Boolean),
    [value]
  )

  const handleAdd = () => {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    if (tags.includes(trimmed)) {
      setInputValue("")
      return
    }
    const newTags = [...tags, trimmed]
    onChange(newTags.join(","))
    setInputValue("")
  }

  const handleRemove = (index: number) => {
    const newTags = tags.filter((_, i) => i !== index)
    onChange(newTags.join(","))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-1" role="list">
        {tags.map((tag, index) => (
          <li key={index} role="listitem">
            <Badge variant="secondary" className="text-xs font-mono flex items-center gap-1">
              {tag}
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="ml-1 hover:text-destructive"
                aria-label="remove"
              >
                ×
              </button>
            </Badge>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Adicionar valor..."
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
        >
          Adicionar
        </Button>
      </div>
    </div>
  )
}

export function ValidatorConfigDialog({
  open,
  onOpenChange,
  validatorCode,
  validatorDisplayName,
  configs,
  onSave,
}: ValidatorConfigDialogProps) {
  const [localValues, setLocalValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {}
      configs.forEach(config => {
        initial[config.id] = config.value
      })
      setLocalValues(initial)
    }
  }, [open, configs])

  const handleValueChange = (configId: string, newValue: string) => {
    setLocalValues(prev => ({
      ...prev,
      [configId]: newValue,
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      for (const config of configs) {
        const newValue = localValues[config.id] ?? config.value
        await onSave(config.id, newValue)
      }
      toast.success("Configurações salvas com sucesso")
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to save config:", error)
      toast.error("Falha ao salvar configurações")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="validator-config-dialog" className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{validatorDisplayName}</DialogTitle>
          <DialogDescription>
            Configure os parâmetros do validator {validatorCode}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {configs.map(config => {
            const inputType = getInputType(config)
            const currentValue = localValues[config.id] ?? config.value

            return (
              <div
                key={config.id}
                className="space-y-2"
                data-testid={`validator-config-field-${config.key}`}
              >
                <Label className="text-sm font-medium">
                  {config.key}
                  {config.description && (
                    <span className="block text-xs text-muted-foreground font-normal mt-0.5">
                      {config.description}
                    </span>
                  )}
                </Label>

                {inputType === "switch" && (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={currentValue === "true"}
                      onCheckedChange={(checked) =>
                        handleValueChange(config.id, checked ? "true" : "false")
                      }
                    />
                    <span className="text-sm text-muted-foreground">
                      {currentValue === "true" ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                )}

                {inputType === "number" && (
                  <Input
                    type="number"
                    value={currentValue}
                    onChange={(e) => handleValueChange(config.id, e.target.value)}
                    role="spinbutton"
                  />
                )}

                {inputType === "tags" && (
                  <TagInput
                    value={currentValue}
                    onChange={(newValue) => handleValueChange(config.id, newValue)}
                  />
                )}

                {inputType === "text" && (
                  <Input
                    type="text"
                    value={currentValue}
                    onChange={(e) => handleValueChange(config.id, e.target.value)}
                  />
                )}
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            data-testid="validator-config-save"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
