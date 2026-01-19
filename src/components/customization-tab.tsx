import { useEffect, useMemo, useState, type ChangeEvent } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api } from "@/lib/api"
import type { CustomizationSettings } from "@/lib/types"
import { useCustomization } from "@/hooks/use-customization"
import { toast } from "sonner"

const FONT_OPTIONS = {
  sans: [
    "Inter",
    "Lato",
    "Montserrat",
    "Open Sans",
    "Oswald",
    "Poppins",
    "Raleway",
    "Roboto",
    "Source Sans 3",
    "Nunito",
    "Work Sans",
    "Ubuntu",
    "Fira Sans",
    "Manrope",
    "Rubik",
  ],
  serif: [
    "Merriweather",
    "Playfair Display",
    "Lora",
    "PT Serif",
    "Source Serif 4",
    "Roboto Slab",
    "Noto Serif",
    "Libre Baskerville",
    "Crimson Text",
    "Cormorant Garamond",
    "EB Garamond",
    "Spectral",
    "Zilla Slab",
    "Alegreya",
    "Arvo",
  ],
  mono: [
    "JetBrains Mono",
    "Fira Code",
    "Source Code Pro",
    "IBM Plex Mono",
    "Roboto Mono",
    "Inconsolata",
    "Space Mono",
    "Ubuntu Mono",
    "PT Mono",
    "Overpass Mono",
    "Cousine",
    "Anonymous Pro",
    "DM Mono",
    "Victor Mono",
    "Share Tech Mono",
  ],
}

type ColorOption = { label: string; value: string }

const COLOR_FAMILIES = [
  { label: "Slate", value: "slate" },
  { label: "Gray", value: "gray" },
  { label: "Red", value: "red" },
  { label: "Orange", value: "orange" },
  { label: "Amber", value: "amber" },
  { label: "Yellow", value: "yellow" },
  { label: "Lime", value: "lime" },
  { label: "Green", value: "green" },
  { label: "Teal", value: "teal" },
  { label: "Cyan", value: "cyan" },
  { label: "Blue", value: "blue" },
  { label: "Indigo", value: "indigo" },
  { label: "Violet", value: "violet" },
  { label: "Purple", value: "purple" },
  { label: "Pink", value: "pink" },
]

const COLOR_OPTION_DEFAULT: ColorOption = { label: "Padrao", value: "default" }
const TEXT_COLOR_OPTIONS: ColorOption[] = [
  COLOR_OPTION_DEFAULT,
  ...COLOR_FAMILIES.map((family) => ({
    label: `${family.label} 11`,
    value: `var(--${family.value}-11)`,
  })),
]
const BACKGROUND_COLOR_OPTIONS: ColorOption[] = [
  COLOR_OPTION_DEFAULT,
  ...COLOR_FAMILIES.map((family) => ({
    label: `${family.label} 9`,
    value: `var(--${family.value}-9)`,
  })),
]

type ColorGroupKey = keyof CustomizationSettings["colors"]
type ColorFieldKey = "background" | "text"

export function CustomizationTab() {
  const { customization, setCustomization } = useCustomization()
  const [form, setForm] = useState<CustomizationSettings>(customization)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(customization)
  }, [customization])

  const maxUploadBytes = useMemo(
    () => Math.floor((form.maxUploadMb || 0) * 1024 * 1024),
    [form.maxUploadMb],
  )

  const applyFormUpdate = (updater: (prev: CustomizationSettings) => CustomizationSettings) => {
    setForm((prev) => {
      const next = updater(prev)
      setCustomization(next)
      return next
    })
  }

  const normalizeColorValue = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed || trimmed === "default") {
      return null
    }
    return trimmed
  }

  const updateColor = (group: ColorGroupKey, field: ColorFieldKey, value: string) => {
    applyFormUpdate((prev) => ({
      ...prev,
      colors: {
        ...prev.colors,
        [group]: {
          ...prev.colors[group],
          [field]: normalizeColorValue(value),
        },
      },
    }))
  }

  const getColorOption = (value: string, options: ColorOption[]) => {
    return options.find((option) => option.value === value) ?? COLOR_OPTION_DEFAULT
  }

  const renderColorOption = (option: ColorOption, withSlot?: boolean) => (
    <span data-slot={withSlot ? "select-value" : undefined} className="flex items-center gap-2">
      <span
        className="h-3 w-3 rounded-[4px] border border-border shrink-0"
        style={{ backgroundColor: option.value === "default" ? "transparent" : option.value }}
      />
      <span>{option.label}</span>
    </span>
  )

  const handleFileChange = (field: "logoUrl" | "faviconUrl") => async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    const isAllowed = file.type === "image/png" || file.type === "image/svg+xml"
    if (!isAllowed) {
      toast.error("Use arquivos PNG ou SVG")
      event.target.value = ""
      return
    }

    if (maxUploadBytes > 0 && file.size > maxUploadBytes) {
      toast.error("Arquivo excede o limite configurado")
      event.target.value = ""
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null
      if (!result) return
      applyFormUpdate((prev) => ({
        ...prev,
        [field]: result,
      }))
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await api.configTables.customization.update(form)
      setCustomization(updated)
      toast.success("Customização salva")
    } catch (error) {
      console.error("Failed to save customization:", error)
      toast.error("Falha ao salvar customização")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-6 bg-card border-border space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Customização</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Ajuste identidade visual, tipografia e cores do Gatekeeper.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Branding</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="custom-app-name">Nome da aplicacao</Label>
            <Input
              id="custom-app-name"
              value={form.appName}
              onChange={(event) =>
                applyFormUpdate((prev) => ({ ...prev, appName: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-app-subtitle">Subnome</Label>
            <Input
              id="custom-app-subtitle"
              value={form.appSubtitle}
              onChange={(event) =>
                applyFormUpdate((prev) => ({ ...prev, appSubtitle: event.target.value }))
              }
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="custom-logo">Logomarca (PNG/SVG)</Label>
            <Input
              id="custom-logo"
              type="file"
              accept="image/png,image/svg+xml"
              onChange={handleFileChange("logoUrl")}
            />
            {form.logoUrl ? (
              <img
                src={form.logoUrl}
                alt="Preview da logomarca"
                className="h-12 w-12 rounded-md border border-border object-contain bg-background"
              />
            ) : (
              <p className="text-xs text-muted-foreground">Sem logomarca definida.</p>
            )}
            <div className="space-y-2 pt-2">
              <Label htmlFor="custom-upload-limit">Limite de upload (MB)</Label>
              <Input
                id="custom-upload-limit"
                type="number"
                min="0.1"
                step="0.1"
                value={Number.isFinite(form.maxUploadMb) ? form.maxUploadMb : ""}
                onChange={(event) =>
                  applyFormUpdate((prev) => ({
                    ...prev,
                    maxUploadMb: Number(event.target.value || 0),
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">Valor padrao: 2MB.</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-favicon">Favicon (PNG/SVG)</Label>
            <Input
              id="custom-favicon"
              type="file"
              accept="image/png,image/svg+xml"
              onChange={handleFileChange("faviconUrl")}
            />
            {form.faviconUrl ? (
              <img
                src={form.faviconUrl}
                alt="Preview do favicon"
                className="h-10 w-10 rounded-md border border-border object-contain bg-background"
              />
            ) : (
              <p className="text-xs text-muted-foreground">Sem favicon definido.</p>
            )}
          </div>
        </div>
      </div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tipografia</h3>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Sans serif</Label>
              <Select
                value={form.fonts.sans}
                onValueChange={(value) =>
                  applyFormUpdate((prev) => ({ ...prev, fonts: { ...prev.fonts, sans: value } }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha uma fonte" />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.sans.map((font) => (
                    <SelectItem key={font} value={font}>
                      {font}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Serif</Label>
              <Select
                value={form.fonts.serif}
                onValueChange={(value) =>
                  applyFormUpdate((prev) => ({ ...prev, fonts: { ...prev.fonts, serif: value } }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha uma fonte" />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.serif.map((font) => (
                    <SelectItem key={font} value={font}>
                      {font}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monospace</Label>
              <Select
                value={form.fonts.mono}
                onValueChange={(value) =>
                  applyFormUpdate((prev) => ({ ...prev, fonts: { ...prev.fonts, mono: value } }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha uma fonte" />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.mono.map((font) => (
                    <SelectItem key={font} value={font}>
                      {font}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Cores</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Tipo</TableHead>
                <TableHead>Texto</TableHead>
                <TableHead>Background</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Accent</TableCell>
                <TableCell>
                  <Select
                    value={form.colors.accent.text ?? "default"}
                    onValueChange={(value) => updateColor("accent", "text", value)}
                  >
                    <SelectTrigger className="w-full">
                      {renderColorOption(
                        getColorOption(form.colors.accent.text ?? "default", TEXT_COLOR_OPTIONS),
                        true,
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {TEXT_COLOR_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {renderColorOption(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={form.colors.accent.background ?? "default"}
                    onValueChange={(value) => updateColor("accent", "background", value)}
                  >
                    <SelectTrigger className="w-full">
                      {renderColorOption(
                        getColorOption(
                          form.colors.accent.background ?? "default",
                          BACKGROUND_COLOR_OPTIONS,
                        ),
                        true,
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {BACKGROUND_COLOR_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {renderColorOption(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Primary</TableCell>
                <TableCell>
                  <Select
                    value={form.colors.primary.text ?? "default"}
                    onValueChange={(value) => updateColor("primary", "text", value)}
                  >
                    <SelectTrigger className="w-full">
                      {renderColorOption(
                        getColorOption(form.colors.primary.text ?? "default", TEXT_COLOR_OPTIONS),
                        true,
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {TEXT_COLOR_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {renderColorOption(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={form.colors.primary.background ?? "default"}
                    onValueChange={(value) => updateColor("primary", "background", value)}
                  >
                    <SelectTrigger className="w-full">
                      {renderColorOption(
                        getColorOption(
                          form.colors.primary.background ?? "default",
                          BACKGROUND_COLOR_OPTIONS,
                        ),
                        true,
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {BACKGROUND_COLOR_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {renderColorOption(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Secondary</TableCell>
                <TableCell>
                  <Select
                    value={form.colors.secondary.text ?? "default"}
                    onValueChange={(value) => updateColor("secondary", "text", value)}
                  >
                    <SelectTrigger className="w-full">
                      {renderColorOption(
                        getColorOption(form.colors.secondary.text ?? "default", TEXT_COLOR_OPTIONS),
                        true,
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {TEXT_COLOR_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {renderColorOption(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={form.colors.secondary.background ?? "default"}
                    onValueChange={(value) => updateColor("secondary", "background", value)}
                  >
                    <SelectTrigger className="w-full">
                      {renderColorOption(
                        getColorOption(
                          form.colors.secondary.background ?? "default",
                          BACKGROUND_COLOR_OPTIONS,
                        ),
                        true,
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {BACKGROUND_COLOR_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {renderColorOption(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Base</TableCell>
                <TableCell>
                  <Select
                    value={form.colors.base.text ?? "default"}
                    onValueChange={(value) => updateColor("base", "text", value)}
                  >
                    <SelectTrigger className="w-full">
                      {renderColorOption(
                        getColorOption(form.colors.base.text ?? "default", TEXT_COLOR_OPTIONS),
                        true,
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {TEXT_COLOR_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {renderColorOption(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={form.colors.base.background ?? "default"}
                    onValueChange={(value) => updateColor("base", "background", value)}
                  >
                    <SelectTrigger className="w-full">
                      {renderColorOption(
                        getColorOption(
                          form.colors.base.background ?? "default",
                          BACKGROUND_COLOR_OPTIONS,
                        ),
                        true,
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {BACKGROUND_COLOR_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {renderColorOption(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      <Separator />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar customização"}
        </Button>
      </div>
    </Card>
  )
}
