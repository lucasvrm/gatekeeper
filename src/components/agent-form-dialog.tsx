import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { api } from "@/lib/api"
import type { CreateAgentInput, LLMAgent, UpdateAgentInput } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form"
import { toast } from "sonner"

type AgentFormValues = {
  name: string
  provider: LLMAgent["provider"]
  model: string
  apiKeyEnvVar: string
  baseUrl: string
  temperature: number
  maxTokens: number
  isDefault: boolean
  projectPath: string
  generatePlanJson: boolean
  generateLog: boolean
  generateTaskPrompt: boolean
  generateSpecFile: boolean
}

interface AgentFormDialogProps {
  open: boolean
  onClose: () => void
  agent?: LLMAgent
}

const PROVIDER_OPTIONS: Array<{ value: LLMAgent["provider"]; label: string }> = [
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google" },
  { value: "ollama", label: "Ollama" },
]

const buildDefaults = (agent?: LLMAgent): AgentFormValues => ({
  name: agent?.name ?? "",
  provider: agent?.provider ?? "anthropic",
  model: agent?.model ?? "",
  apiKeyEnvVar: agent?.apiKeyEnvVar ?? "",
  baseUrl: agent?.baseUrl ?? "",
  temperature: agent?.temperature ?? 0.7,
  maxTokens: agent?.maxTokens ?? 4096,
  isDefault: agent?.isDefault ?? false,
  projectPath: agent?.projectPath ?? ".",
  generatePlanJson: agent?.generatePlanJson ?? true,
  generateLog: agent?.generateLog ?? true,
  generateTaskPrompt: agent?.generateTaskPrompt ?? true,
  generateSpecFile: agent?.generateSpecFile ?? true,
})

export function AgentFormDialog({ open, onClose, agent }: AgentFormDialogProps) {
  const [saving, setSaving] = useState(false)

  const form = useForm<AgentFormValues>({
    defaultValues: buildDefaults(agent),
    mode: "onChange",
  })

  const provider = form.watch("provider")
  const temperature = form.watch("temperature")

  useEffect(() => {
    if (open) {
      form.reset(buildDefaults(agent))
    }
  }, [open, agent, form])

  const handleSubmit = form.handleSubmit(async (values) => {
    setSaving(true)
    try {
      const payloadBase = {
        name: values.name.trim(),
        provider: values.provider,
        model: values.model.trim(),
        apiKeyEnvVar: values.apiKeyEnvVar.trim() || null,
        baseUrl: values.provider === "ollama" ? values.baseUrl.trim() || null : null,
        temperature: values.temperature,
        maxTokens: values.maxTokens,
        isDefault: values.isDefault,
        projectPath: values.projectPath.trim() || ".",
        generatePlanJson: values.generatePlanJson,
        generateLog: values.generateLog,
        generateTaskPrompt: values.generateTaskPrompt,
        generateSpecFile: values.generateSpecFile,
      }

      if (agent) {
        const payload: UpdateAgentInput = payloadBase
        await api.agents.update(agent.id, payload)
        toast.success("Agent updated")
      } else {
        const payload: CreateAgentInput = payloadBase
        await api.agents.create(payload)
        toast.success("Agent created")
      }

      onClose()
    } catch (error) {
      console.error("Failed to save agent:", error)
      toast.error("Failed to save agent")
    } finally {
      setSaving(false)
    }
  })

  const temperatureLabel = useMemo(() => temperature.toFixed(2), [temperature])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? onClose() : null)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{agent ? "Edit Agent" : "New Agent"}</DialogTitle>
          <DialogDescription>
            Configure how the elicitor connects to your LLM provider.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              rules={{
                required: "Name is required",
                minLength: { value: 3, message: "Minimum 3 characters" },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Agent name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDER_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="model"
              rules={{ required: "Model is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Model name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="apiKeyEnvVar"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key Env Var</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="OPENAI_API_KEY" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {provider === "ollama" ? (
              <FormField
                control={form.control}
                name="baseUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base URL</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="http://localhost:11434" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="temperature"
              rules={{
                min: { value: 0, message: "Minimum 0" },
                max: { value: 1, message: "Maximum 1" },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Temperature ({temperatureLabel})</FormLabel>
                  <FormControl>
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={[field.value]}
                      onValueChange={(value) => field.onChange(value[0] ?? 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="maxTokens"
              rules={{
                min: { value: 1, message: "Minimum 1" },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Tokens</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={field.value}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center gap-2">
              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                      />
                    </FormControl>
                    <Label>Default agent</Label>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="advanced">
                <AccordionTrigger>Advanced Settings</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="projectPath"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Path</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="." />
                        </FormControl>
                        <FormDescription>
                          Base path for the project (used for manifest files). Defaults to current directory.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-3">
                    <Label>Output Files</Label>

                    <FormField
                      control={form.control}
                      name="generatePlanJson"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                            />
                          </FormControl>
                          <Label>Generate plan.json</Label>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="generateLog"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                            />
                          </FormControl>
                          <Label>Generate elicitation.log.json</Label>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="generateTaskPrompt"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                            />
                          </FormControl>
                          <Label>Generate taskPrompt.md</Label>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="generateSpecFile"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                            />
                          </FormControl>
                          <Label>Generate {'{slug}'}.spec.tsx</Label>
                        </FormItem>
                      )}
                    />

                    <div className="text-sm text-muted-foreground">
                      Note: contract.md is always generated (required)
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
