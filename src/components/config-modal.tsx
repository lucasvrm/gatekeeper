import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

export type ConfigModalField = {
  name: string
  label: string
  type: "text" | "textarea" | "boolean"
  required?: boolean
}

interface ConfigModalProps {
  open: boolean
  title: string
  description?: string
  fields: ConfigModalField[]
  initialValues: Record<string, string | boolean>
  submitLabel: string
  submitting: boolean
  onClose: () => void
  onSubmit: (values: Record<string, string | boolean>) => Promise<boolean>
}

export function ConfigModal({
  open,
  title,
  description,
  fields,
  initialValues,
  submitLabel,
  submitting,
  onClose,
  onSubmit,
}: ConfigModalProps) {
  const [values, setValues] = useState<Record<string, string | boolean>>(initialValues)

  useEffect(() => {
    if (open) {
      setValues(initialValues)
    }
  }, [open, initialValues])

  const handleSubmit = async () => {
    const ok = await onSubmit(values)
    if (ok) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? onClose() : null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4">
          {fields.map((field) => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={field.name}>
                {field.label}
                {field.required ? " *" : ""}
              </Label>
              {field.type === "textarea" ? (
                <Textarea
                  id={field.name}
                  value={String(values[field.name] ?? "")}
                  onChange={(event) =>
                    setValues((prev) => ({
                      ...prev,
                      [field.name]: event.target.value,
                    }))
                  }
                />
              ) : field.type === "boolean" ? (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={field.name}
                    checked={Boolean(values[field.name])}
                    onCheckedChange={(checked) =>
                      setValues((prev) => ({
                        ...prev,
                        [field.name]: Boolean(checked),
                      }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {values[field.name] ? "Active" : "Inactive"}
                  </span>
                </div>
              ) : (
                <Input
                  id={field.name}
                  value={String(values[field.name] ?? "")}
                  onChange={(event) =>
                    setValues((prev) => ({
                      ...prev,
                      [field.name]: event.target.value,
                    }))
                  }
                />
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
