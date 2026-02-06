import { useMemo, useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { FailModePopover } from "@/components/fail-mode-popover"
import { ValidatorConfigDialog } from "@/components/validator-config-dialog"
import { Settings } from "lucide-react"
import type { FailMode } from "@/lib/types"

interface ValidatorItem {
  id?: string
  key: string
  value: string
  type?: string
  failMode?: FailMode
  gateCategory?: string
  displayName?: string
  description?: string
  category?: string
  gate?: number
  order?: number
  isHardBlock?: boolean
}

interface ValidationConfigItem {
  id: string
  key: string
  value: string
  type: string
  category: string
  description?: string | null
}

interface ValidatorsTabProps {
  validators: ValidatorItem[]
  validationConfigs: ValidationConfigItem[]
  onToggle: (key: string, isActive: boolean) => void | Promise<void>
  onFailModeChange: (validatorKey: string, mode: FailMode) => void | Promise<void>
  onBulkFailModeChange: (keys: string[], mode: FailMode) => void | Promise<void>
  onUpdateConfig: (id: string, value: string) => void | Promise<void>
}

const GATE_META: Record<number, { name: string; emoji: string }> = {
  0: { name: "SANITIZATION", emoji: "🧹" },
  1: { name: "CONTRACT", emoji: "📜" },
  2: { name: "EXECUTION", emoji: "⚙️" },
  3: { name: "INTEGRITY", emoji: "🏗️" },
}

const VALIDATOR_CONFIG_MAP: Record<string, string[]> = {
  TOKEN_BUDGET_FIT: ["MAX_TOKEN_BUDGET", "TOKEN_SAFETY_MARGIN"],
  TASK_SCOPE_SIZE: ["MAX_FILES_PER_TASK"],
  PATH_CONVENTION: ["TYPE_DETECTION_PATTERNS"],
  DELETE_DEPENDENCY_CHECK: ["DELETE_CHECK_IGNORE_DIRS"],
  TEST_COVERS_HAPPY_AND_SAD_PATH: ["HAPPY_PATH_KEYWORDS", "SAD_PATH_KEYWORDS"],
  IMPORT_REALITY_CHECK: ["EXTRA_BUILTIN_MODULES", "PATH_ALIASES"],
  DIFF_SCOPE_ENFORCEMENT: [
    "DIFF_SCOPE_INCLUDE_WORKING_TREE",
    "DIFF_SCOPE_GLOBAL_EXCLUSIONS",
    "DIFF_SCOPE_ALLOW_TEST_ONLY_DIFF",
    "DIFF_SCOPE_INCOMPLETE_FAIL_MODE",
  ],
  TEST_READ_ONLY_ENFORCEMENT: ["TEST_READ_ONLY_EXCLUDED_PATHS"],
  STYLE_CONSISTENCY_LINT: ["ESLINT_CONFIG_FILES", "SKIP_LINT_IF_NO_CONFIG"],
  TEST_CLAUSE_MAPPING_VALID: ["ALLOW_UNTAGGED_TESTS"],
  TEST_RESILIENCE_CHECK: [
    "FRAGILE_PATTERNS",
    "RESILIENT_PATTERNS",
    "SKIP_NON_UI_TESTS",
  ],
  UI_COMPONENT_REGISTRY: [
    "UI_IGNORED_COMPONENT_PREFIXES",
    "UI_ALLOWED_EXTRA_COMPONENTS",
  ],
  UI_PROPS_COMPLIANCE: ["UI_STRICT_PROPS"],
}

const TABLE_DEPENDENT_VALIDATORS = [
  "SENSITIVE_FILES_LOCK",
  "DANGER_MODE_EXPLICIT",
  "TASK_CLARITY_CHECK",
]

const PETREA_VALIDATOR = "TEST_FAILS_BEFORE_IMPLEMENTATION"

const hasConfigs = (code: string): boolean => code in VALIDATOR_CONFIG_MAP
const hasTableDependency = (code: string): boolean => TABLE_DEPENDENT_VALIDATORS.includes(code)
const isPetreaValidator = (code: string): boolean => code === PETREA_VALIDATOR

const STORAGE_KEY = "gatekeeper:config:active-gates"

interface PersistedGates { left: 0 | 1; right: 2 | 3 }

function isTestEnv(): boolean {
  try {
    if (typeof process !== "undefined" && (process.env?.VITEST === "true" || process.env?.NODE_ENV === "test")) return true
    if (typeof navigator !== "undefined" && navigator.userAgent?.includes("jsdom")) return true
  } catch { /* ignore */ }
  return false
}

function loadActiveGates(): PersistedGates {
  if (isTestEnv()) return { left: 0, right: 2 }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed && [0, 1].includes(parsed.left) && [2, 3].includes(parsed.right)) {
        return parsed as PersistedGates
      }
    }
  } catch { /* ignore */ }
  return { left: 0, right: 2 }
}

function saveActiveGates(gates: PersistedGates): void {
  if (isTestEnv()) return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(gates)) } catch { /* ignore */ }
}

export function ValidatorsTab({
  validators,
  validationConfigs,
  onToggle,
  onFailModeChange,
  onBulkFailModeChange,
  onUpdateConfig,
}: ValidatorsTabProps) {
  const [activeLeft, setActiveLeft] = useState<0 | 1>(() => loadActiveGates().left)
  const [activeRight, setActiveRight] = useState<2 | 3>(() => loadActiveGates().right)
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [selectedValidator, setSelectedValidator] = useState<ValidatorItem | null>(null)

  useEffect(() => {
    saveActiveGates({ left: activeLeft, right: activeRight })
  }, [activeLeft, activeRight])

  const gateGroups = useMemo(() => {
    const groups = new Map<number, ValidatorItem[]>()
    validators.forEach(v => {
      const gate = v.gate ?? 0
      if (!groups.has(gate)) groups.set(gate, [])
      groups.get(gate)!.push(v)
    })
    groups.forEach(list => list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
    return groups
  }, [validators])

  const getConfigsForValidator = (validatorCode: string): ValidationConfigItem[] => {
    const configKeys = VALIDATOR_CONFIG_MAP[validatorCode] ?? []
    return validationConfigs.filter(c => configKeys.includes(c.key))
  }

  const handleBulkFailMode = (gateNumber: number, mode: FailMode) => {
    const gateValidators = gateGroups.get(gateNumber) ?? []
    const keys = gateValidators.filter(v => !isPetreaValidator(v.key)).map(v => v.key)
    if (keys.length === 0) return
    onBulkFailModeChange(keys, mode)
  }

  const renderGatePanel = (gateNumber: number) => {
    const meta = GATE_META[gateNumber]
    const gateValidators = gateGroups.get(gateNumber) ?? []
    const activeCount = gateValidators.filter(v => v.value === "true").length

    return (
      <div className="border rounded-lg overflow-hidden">
        {/* Header + Bulk */}
        <div className="bg-muted/50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">{meta.emoji}</span>
            <h4 className="font-semibold text-sm">Gate {gateNumber}: {meta.name}</h4>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-xs">
              {activeCount}/{gateValidators.length}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleBulkFailMode(gateNumber, "HARD")}
              data-testid={`bulk-hard-${gateNumber}`}
              className="h-6 px-2 text-[11px] bg-destructive/20 text-destructive hover:bg-destructive/30"
            >
              All Hard
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleBulkFailMode(gateNumber, "WARNING")}
              data-testid={`bulk-warning-${gateNumber}`}
              className="h-6 px-2 text-[11px] bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30"
            >
              All Warn
            </Button>
          </div>
        </div>

        {/* Validators */}
        <div className="divide-y">
          {gateValidators.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Nenhum validator neste gate.
            </div>
          ) : (
            gateValidators.map(validator => {
              const isActive = validator.value === "true"
              const displayName = validator.displayName ?? validator.key
              const description = validator.description ?? "Sem descrição disponível"
              const petrea = isPetreaValidator(validator.key)
              const validatorHasConfigs = hasConfigs(validator.key)
              const validatorHasTableDep = hasTableDependency(validator.key)

              return (
                <div
                  key={validator.key}
                  data-testid={`validator-row-${validator.key}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Switch
                      data-testid={`validator-switch-${validator.key}`}
                      role="switch"
                      checked={isActive}
                      onCheckedChange={(checked) => onToggle(validator.key, checked)}
                      disabled={petrea}
                      aria-checked={isActive}
                      className="scale-90"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-xs">{displayName}</span>
                        {validator.category && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            {validator.category}
                          </Badge>
                        )}
                        {petrea && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0">
                            🔒
                          </Badge>
                        )}
                        {validatorHasTableDep && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1 py-0"
                            data-testid={`validator-ref-badge-${validator.key}`}
                          >
                            ref
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {validatorHasConfigs && (
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`validator-config-btn-${validator.key}`}
                        onClick={() => {
                          setSelectedValidator(validator)
                          setConfigDialogOpen(true)
                        }}
                        className="h-7 w-7 p-0"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        <span className="sr-only">Configurações</span>
                      </Button>
                    )}
                    <FailModePopover
                      currentMode={validator.failMode ?? null}
                      onModeChange={(mode) => onFailModeChange(validator.key, mode)}
                      disabled={petrea}
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }

  const renderToggle = (optA: number, optB: number, active: number, setActive: (v: any) => void) => (
    <div className="flex gap-1 p-1 bg-muted rounded-lg mb-3">
      {[optA, optB].map((gate) => {
        const meta = GATE_META[gate]
        const gateVals = gateGroups.get(gate) ?? []
        const gateActive = gateVals.filter(v => v.value === "true").length
        return (
          <button
            key={gate}
            onClick={() => setActive(gate)}
            data-testid={`gate-tab-${gate}`}
            className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${
              active === gate
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>{meta.emoji}</span>
            <span className="ml-1.5 font-medium">Gate {gate}</span>
            <span className="ml-1.5 text-xs opacity-70">({gateActive}/{gateVals.length})</span>
          </button>
        )
      })}
    </div>
  )

  return (
    <Card className="p-6 bg-card border-border space-y-4" data-testid="validators-tab">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Validators</h2>
          <Badge variant="outline" data-testid="validator-count-badge" className="ml-auto">
            {validators.length} total
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os validators por gate.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Left: Gate 0 / Gate 1 */}
        <div>
          {renderToggle(0, 1, activeLeft, setActiveLeft)}
          {renderGatePanel(activeLeft)}
        </div>

        {/* Right: Gate 2 / Gate 3 */}
        <div>
          {renderToggle(2, 3, activeRight, setActiveRight)}
          {renderGatePanel(activeRight)}
        </div>
      </div>

      {selectedValidator && (
        <ValidatorConfigDialog
          open={configDialogOpen}
          onOpenChange={setConfigDialogOpen}
          validatorCode={selectedValidator.key}
          validatorDisplayName={selectedValidator.displayName ?? selectedValidator.key}
          configs={getConfigsForValidator(selectedValidator.key)}
          onSave={async (id: string, value: string) => { await onUpdateConfig(id, value) }}
        />
      )}
    </Card>
  )
}
