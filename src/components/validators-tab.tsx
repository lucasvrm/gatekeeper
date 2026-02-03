import { useMemo, useState, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { FailModePopover } from "@/components/fail-mode-popover"
import { ValidatorConfigDialog } from "@/components/validator-config-dialog"
import { ChevronDown, ChevronRight, Settings } from "lucide-react"
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
  onUpdateConfig: (id: string, value: string) => void | Promise<void>
}

// Gate metadata
const GATE_META: Record<number, { name: string; emoji: string }> = {
  0: { name: "SANITIZATION", emoji: "🧹" },
  1: { name: "CONTRACT", emoji: "📜" },
  2: { name: "EXECUTION", emoji: "⚙️" },
  3: { name: "INTEGRITY", emoji: "🏗️" },
}

// Mapping validator code → config keys
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

// Validators that depend on external tables
const TABLE_DEPENDENT_VALIDATORS = [
  "SENSITIVE_FILES_LOCK",
  "DANGER_MODE_EXPLICIT",
  "TASK_CLARITY_CHECK",
]

// Validator that cannot be disabled
const PETREA_VALIDATOR = "TEST_FAILS_BEFORE_IMPLEMENTATION"

const hasConfigs = (code: string): boolean => code in VALIDATOR_CONFIG_MAP
const hasTableDependency = (code: string): boolean => TABLE_DEPENDENT_VALIDATORS.includes(code)
const isPetrea = (code: string): boolean => code === PETREA_VALIDATOR

const STORAGE_KEY = "gatekeeper:config:expanded-gates"

// Detect test environment to avoid localStorage pollution between tests
function isTestEnvironment(): boolean {
  try {
    // Check for Vitest
    if (typeof process !== "undefined" && process.env?.VITEST === "true") return true
    if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") return true
    // Check for jsdom (common in test environments)
    if (typeof navigator !== "undefined" && navigator.userAgent?.includes("jsdom")) return true
  } catch {
    // Ignore errors in checking
  }
  return false
}

function loadExpandedGates(): Set<number> {
  if (isTestEnvironment()) return new Set() // Skip localStorage in tests
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((n): n is number => typeof n === "number"))
      }
    }
  } catch {
    // Ignore parse errors
  }
  return new Set() // Default: all closed
}

function saveExpandedGates(gates: Set<number>): void {
  if (isTestEnvironment()) return // Skip localStorage in tests
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...gates]))
  } catch {
    // Ignore storage errors
  }
}

export function ValidatorsTab({
  validators,
  validationConfigs,
  onToggle,
  onFailModeChange,
  onUpdateConfig,
}: ValidatorsTabProps) {
  // Track which gates are expanded (default: all closed, persisted in localStorage)
  const [expandedGates, setExpandedGates] = useState<Set<number>>(() => loadExpandedGates())

  // Persist expanded gates to localStorage
  useEffect(() => {
    saveExpandedGates(expandedGates)
  }, [expandedGates])

  // Track which validator config dialog is open
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [selectedValidator, setSelectedValidator] = useState<ValidatorItem | null>(null)

  // Group validators by gate
  const gateGroups = useMemo(() => {
    const groups = new Map<number, ValidatorItem[]>()
    validators.forEach(v => {
      const gate = v.gate ?? 0
      if (!groups.has(gate)) groups.set(gate, [])
      groups.get(gate)!.push(v)
    })
    // Sort by order within each gate
    groups.forEach(list => list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
    return groups
  }, [validators])

  const toggleGate = (gateNumber: number) => {
    setExpandedGates(prev => {
      const next = new Set(prev)
      if (next.has(gateNumber)) {
        next.delete(gateNumber)
      } else {
        next.add(gateNumber)
      }
      return next
    })
  }

  const getConfigsForValidator = (validatorCode: string): ValidationConfigItem[] => {
    const configKeys = VALIDATOR_CONFIG_MAP[validatorCode] ?? []
    return validationConfigs.filter(c => configKeys.includes(c.key))
  }

  const openConfigDialog = (validator: ValidatorItem) => {
    setSelectedValidator(validator)
    setConfigDialogOpen(true)
  }

  const handleConfigSave = async (id: string, value: string) => {
    await onUpdateConfig(id, value)
  }

  // Render gate sections for gates 0-3
  const gates = [0, 1, 2, 3]

  return (
    <Card className="p-6 bg-card border-border space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Validators</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os validators por gate. Clique em um gate para expandir/colapsar.
        </p>
      </div>

      <div className="space-y-3">
        {gates.map(gateNumber => {
          const meta = GATE_META[gateNumber] ?? { name: `GATE ${gateNumber}`, emoji: "📋" }
          const gateValidators = gateGroups.get(gateNumber) ?? []
          const activeCount = gateValidators.filter(v => v.value === "true").length
          const totalCount = gateValidators.length
          const isExpanded = expandedGates.has(gateNumber)

          return (
            <Collapsible
              key={gateNumber}
              open={isExpanded}
              onOpenChange={() => toggleGate(gateNumber)}
              data-testid={`gate-section-${gateNumber}`}
            >
              <CollapsibleTrigger
                className="w-full"
                data-testid={`gate-header-${gateNumber}`}
              >
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="text-lg">{meta.emoji}</span>
                    <span className="font-semibold">
                      Gate {gateNumber} — {meta.name}
                    </span>
                  </div>
                  <Badge
                    variant="secondary"
                    data-testid={`gate-active-count-${gateNumber}`}
                  >
                    {activeCount} / {totalCount}
                  </Badge>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent
                forceMount
                className="mt-2"
                style={{ display: isExpanded ? undefined : "none" }}
              >
                <div className="space-y-2 pl-8 pr-4">
                  {gateValidators.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4">
                      Nenhum validator neste gate.
                    </div>
                  ) : (
                    gateValidators.map(validator => {
                      const isActive = validator.value === "true"
                      const displayName = validator.displayName ?? validator.key
                      const description = validator.description ?? "Sem descrição disponível"
                      const validatorIsPetrea = isPetrea(validator.key)
                      const validatorHasConfigs = hasConfigs(validator.key)
                      const validatorHasTableDep = hasTableDependency(validator.key)

                      return (
                        <div
                          key={validator.key}
                          data-testid={`validator-row-${validator.key}`}
                          className="flex items-center justify-between p-3 border rounded-lg bg-background"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Switch
                              data-testid={`validator-switch-${validator.key}`}
                              role="switch"
                              checked={isActive}
                              onCheckedChange={(checked) => onToggle(validator.key, checked)}
                              disabled={validatorIsPetrea}
                              aria-checked={isActive}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{displayName}</span>
                                {validator.category && (
                                  <Badge variant="outline" className="text-xs">
                                    {validator.category}
                                  </Badge>
                                )}
                                {validatorIsPetrea && (
                                  <Badge variant="destructive" className="text-xs">
                                    🔒 PÉTREA
                                  </Badge>
                                )}
                                {validatorHasTableDep && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                    data-testid={`validator-ref-badge-${validator.key}`}
                                  >
                                    ref
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {description}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <FailModePopover
                              currentMode={validator.failMode ?? null}
                              onModeChange={(mode) => onFailModeChange(validator.key, mode)}
                              disabled={validatorIsPetrea}
                            />

                            {validatorHasConfigs && (
                              <Button
                                variant="ghost"
                                size="sm"
                                data-testid={`validator-config-btn-${validator.key}`}
                                onClick={() => openConfigDialog(validator)}
                                className="h-8 w-8 p-0"
                              >
                                <Settings className="h-4 w-4" />
                                <span className="sr-only">Configurações</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </div>

      {/* Validator Config Dialog */}
      {selectedValidator && (
        <ValidatorConfigDialog
          open={configDialogOpen}
          onOpenChange={setConfigDialogOpen}
          validatorCode={selectedValidator.key}
          validatorDisplayName={selectedValidator.displayName ?? selectedValidator.key}
          configs={getConfigsForValidator(selectedValidator.key)}
          onSave={handleConfigSave}
        />
      )}
    </Card>
  )
}
