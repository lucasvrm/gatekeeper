import { useMemo, useState } from "react"
import { usePersistedSections } from "@/hooks/use-persisted-sections"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { PhaseConfigTab } from "./phase-config-tab"
import { ChevronDown } from "lucide-react"

interface ValidationConfigItem {
  id: string
  key: string
  value: string
  type: string
  category: string
  description?: string | null
}

interface AdvancedTabProps {
  validationConfigs: ValidationConfigItem[]
  onUpdateConfig: (id: string, value: string) => Promise<void>
}

// Mapping of config keys to their UI location
const CONFIG_LOCATION_MAP: Record<string, string> = {
  MAX_TOKEN_BUDGET: "Validators → TOKEN_BUDGET_FIT dialog",
  TOKEN_SAFETY_MARGIN: "Validators → TOKEN_BUDGET_FIT dialog",
  MAX_FILES_PER_TASK: "Validators → TASK_SCOPE_SIZE dialog",
  TYPE_DETECTION_PATTERNS: "Validators → PATH_CONVENTION dialog",
  DELETE_CHECK_IGNORE_DIRS: "Validators → DELETE_DEPENDENCY_CHECK dialog",
  HAPPY_PATH_KEYWORDS: "Validators → TEST_COVERS_HAPPY_AND_SAD_PATH dialog",
  SAD_PATH_KEYWORDS: "Validators → TEST_COVERS_HAPPY_AND_SAD_PATH dialog",
  EXTRA_BUILTIN_MODULES: "Validators → IMPORT_REALITY_CHECK dialog",
  PATH_ALIASES: "Validators → IMPORT_REALITY_CHECK dialog",
  DIFF_SCOPE_INCLUDE_WORKING_TREE: "Validators → DIFF_SCOPE_ENFORCEMENT dialog",
  DIFF_SCOPE_GLOBAL_EXCLUSIONS: "Validators → DIFF_SCOPE_ENFORCEMENT dialog",
  DIFF_SCOPE_ALLOW_TEST_ONLY_DIFF: "Validators → DIFF_SCOPE_ENFORCEMENT dialog",
  DIFF_SCOPE_INCOMPLETE_FAIL_MODE: "Validators → DIFF_SCOPE_ENFORCEMENT dialog",
  TEST_READ_ONLY_EXCLUDED_PATHS: "Validators → TEST_READ_ONLY_ENFORCEMENT dialog",
  ESLINT_CONFIG_FILES: "Validators → STYLE_CONSISTENCY_LINT dialog",
  SKIP_LINT_IF_NO_CONFIG: "Validators → STYLE_CONSISTENCY_LINT dialog",
  ALLOW_UNTAGGED_TESTS: "Validators → TEST_CLAUSE_MAPPING_VALID dialog",
  FRAGILE_PATTERNS: "Validators → TEST_RESILIENCE_CHECK dialog",
  RESILIENT_PATTERNS: "Validators → TEST_RESILIENCE_CHECK dialog",
  SKIP_NON_UI_TESTS: "Validators → TEST_RESILIENCE_CHECK dialog",
  UI_IGNORED_COMPONENT_PREFIXES: "Validators → UI_COMPONENT_REGISTRY dialog",
  UI_ALLOWED_EXTRA_COMPONENTS: "Validators → UI_COMPONENT_REGISTRY dialog",
  UI_STRICT_PROPS: "Validators → UI_PROPS_COMPLIANCE dialog",
  ALLOW_SOFT_GATES: "Advanced → Global Flags",
  PROJECT_ROOT: "Conventions → System Paths",
  BACKEND_WORKSPACE: "Conventions → System Paths",
  ARTIFACTS_DIR: "Conventions → System Paths",
  TEST_FILE_PATH: "Conventions → System Paths",
  SANDBOX_DIR: "Conventions → System Paths",
  UI_CONTRACTS_DIR: "Conventions → System Paths",
  TEST_EXECUTION_TIMEOUT_MS: "Advanced → Timeouts",
  COMPILATION_TIMEOUT_MS: "Advanced → Timeouts",
  BUILD_TIMEOUT_MS: "Advanced → Timeouts",
  LINT_TIMEOUT_MS: "Advanced → Timeouts",
}

const TIMEOUT_KEYS = [
  "TEST_EXECUTION_TIMEOUT_MS",
  "COMPILATION_TIMEOUT_MS",
  "BUILD_TIMEOUT_MS",
  "LINT_TIMEOUT_MS",
]

export function AdvancedTab({ validationConfigs, onUpdateConfig }: AdvancedTabProps) {
  const [timeoutValues, setTimeoutValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  // Collapsible states with localStorage persistence
  const [openSections, toggleSection] = usePersistedSections("advanced", {
    llmConfig: true,
    globalFlags: true,
    timeouts: false,
    allConfigs: false,
    coverageAudit: false,
  })

  const allowSoftGatesConfig = useMemo(() =>
    validationConfigs.find(c => c.key === "ALLOW_SOFT_GATES"),
    [validationConfigs]
  )

  const timeoutConfigs = useMemo(() =>
    validationConfigs.filter(c => TIMEOUT_KEYS.includes(c.key)),
    [validationConfigs]
  )

  const handleToggleAllowSoftGates = async (checked: boolean) => {
    if (!allowSoftGatesConfig) return
    setSaving("ALLOW_SOFT_GATES")
    try {
      await onUpdateConfig(allowSoftGatesConfig.id, checked ? "true" : "false")
      toast.success("ALLOW_SOFT_GATES atualizado")
    } catch (error) {
      console.error("Failed to update ALLOW_SOFT_GATES:", error)
      toast.error("Falha ao atualizar ALLOW_SOFT_GATES")
    } finally {
      setSaving(null)
    }
  }

  const handleTimeoutChange = (configId: string, key: string, value: string) => {
    setTimeoutValues(prev => ({ ...prev, [key]: value }))
  }

  const handleSaveTimeout = async (config: ValidationConfigItem) => {
    const newValue = timeoutValues[config.key] ?? config.value
    if (newValue === config.value) return

    setSaving(config.key)
    try {
      await onUpdateConfig(config.id, newValue)
      toast.success(`${config.key} atualizado`)
    } catch (error) {
      console.error(`Failed to update ${config.key}:`, error)
      toast.error(`Falha ao atualizar ${config.key}`)
    } finally {
      setSaving(null)
    }
  }

  const coverageAuditEntries = useMemo(() => {
    const entries: Array<{ key: string; location: string }> = []
    for (const [key, location] of Object.entries(CONFIG_LOCATION_MAP)) {
      entries.push({ key, location })
    }
    return entries.sort((a, b) => a.key.localeCompare(b.key))
  }, [])

  return (
    <div className="space-y-6">
      {/* Pipeline LLM Config Section - Full width */}
      <Collapsible open={openSections.llmConfig} onOpenChange={() => toggleSection('llmConfig')}>
        <Card data-testid="pipeline-llm-config-section">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pipeline LLM Config</CardTitle>
                  <CardDescription>
                    Configure provider, modelo e tokens para cada fase do pipeline.
                  </CardDescription>
                </div>
                <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openSections.llmConfig ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <PhaseConfigTab />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Two columns grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Global Flags Section */}
        <Collapsible open={openSections.globalFlags} onOpenChange={() => toggleSection('globalFlags')}>
          <Card data-testid="global-flags-section">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Global Flags</CardTitle>
                    <CardDescription>
                      Flags globais que afetam o comportamento.
                    </CardDescription>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openSections.globalFlags ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">ALLOW_SOFT_GATES</Label>
                    <p className="text-sm text-muted-foreground">
                      Permite gates com warnings não bloquearem.
                    </p>
                  </div>
                  <Switch
                    data-testid="allow-soft-gates-switch"
                    role="switch"
                    checked={allowSoftGatesConfig?.value === "true"}
                    onCheckedChange={handleToggleAllowSoftGates}
                    disabled={saving === "ALLOW_SOFT_GATES"}
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Timeouts Section */}
        <Collapsible open={openSections.timeouts} onOpenChange={() => toggleSection('timeouts')}>
          <Card data-testid="timeouts-section">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Timeouts</CardTitle>
                    <CardDescription>
                      Timeouts para operações de validação (ms).
                    </CardDescription>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openSections.timeouts ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {TIMEOUT_KEYS.map(key => {
                    const config = timeoutConfigs.find(c => c.key === key)
                    const value = timeoutValues[key] ?? config?.value ?? ""

                    return (
                      <div
                        key={key}
                        data-testid={`timeout-field-${key}`}
                        className="space-y-2 p-3 border rounded-lg"
                      >
                        <Label className="text-xs font-medium">{key.replace(/_/g, ' ')}</Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            value={value}
                            onChange={(e) => config && handleTimeoutChange(config.id, key, e.target.value)}
                            placeholder="ms"
                            className="flex-1 h-8 text-sm"
                          />
                        </div>
                        {config && timeoutValues[key] && timeoutValues[key] !== config.value && (
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleSaveTimeout(config)}
                            disabled={saving === key}
                          >
                            {saving === key ? "..." : "Salvar"}
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* All Configs Debug View Section */}
        <Collapsible open={openSections.allConfigs} onOpenChange={() => toggleSection('allConfigs')}>
          <Card data-testid="all-configs-debug-view">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>All Configs (Debug)</CardTitle>
                    <CardDescription>
                      Visualização de todas as configs.
                    </CardDescription>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openSections.allConfigs ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="rounded-md border max-h-64 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs uppercase tracking-wide">Key</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationConfigs.map(config => (
                        <TableRow key={config.id}>
                          <TableCell className="font-mono text-xs">{config.key}</TableCell>
                          <TableCell className="text-xs max-w-xs truncate" title={config.value}>
                            {config.value}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Coverage Audit Section */}
        <Collapsible open={openSections.coverageAudit} onOpenChange={() => toggleSection('coverageAudit')}>
          <Card data-testid="coverage-audit-section">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Coverage Audit</CardTitle>
                    <CardDescription>
                      Mapeamento de config keys na UI.
                    </CardDescription>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openSections.coverageAudit ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="rounded-md border max-h-64 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs uppercase tracking-wide">Key</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide">Local</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coverageAuditEntries.map(entry => (
                        <TableRow key={entry.key}>
                          <TableCell className="font-mono text-xs">{entry.key}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{entry.location}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Total: {coverageAuditEntries.length} keys
                </p>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </div>
  )
}
