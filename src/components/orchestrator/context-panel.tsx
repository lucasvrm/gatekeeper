import { useState, useEffect } from "react"
import type { Project, ArtifactFolder, AgentPhaseConfig } from "@/lib/types"
import type { StepLLMConfig, LogEntry } from "./types"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { generateStepLabel, generateStepDescription } from "./step-utils"

interface ContextPanelProps {
  // Project & Type
  projects: Project[]
  selectedProjectId: string | null
  onProjectChange: (id: string | null) => void
  taskType?: string
  onTaskTypeChange: (type?: string) => void

  // LLM config (Steps 1, 2, 4)
  stepLLMs: Record<number, StepLLMConfig>
  onStepLLMChange: (step: number, field: "provider" | "model", value: string) => void
  providerModels: Record<string, { label: string; models: { value: string; label: string }[] }>
  getDefault: (step: number) => StepLLMConfig

  // Phase defaults para renderização dinâmica de steps
  phaseDefaults: AgentPhaseConfig[]

  // Rerun
  diskArtifacts: ArtifactFolder[]
  showRerunPicker: boolean
  onToggleRerunPicker: () => void
  onRerunFromDisk: (outputId: string) => Promise<void>
  rerunLoading: boolean

  // State
  loading: boolean

  // Log
  logs: LogEntry[]
  debugMode: boolean
  onToggleDebug: () => void
  onOpenLogs: () => void
  logsCount: number
}

// Componente interno com o conteúdo do painel
function PanelContent(props: ContextPanelProps) {
  const {
    projects,
    selectedProjectId,
    onProjectChange,
    taskType,
    onTaskTypeChange,
    stepLLMs,
    onStepLLMChange,
    providerModels,
    getDefault,
    phaseDefaults,
    diskArtifacts,
    showRerunPicker,
    onToggleRerunPicker,
    onRerunFromDisk,
    rerunLoading,
    loading,
    logs,
    debugMode,
    onToggleDebug,
    onOpenLogs,
    logsCount,
  } = props

  return (
    <div className="space-y-4">
      {/* ─── Projeto + Tipo ─────────────────────────────────────── */}
      <div className="space-y-3 p-4 border rounded-lg">
        <h3 className="text-sm font-semibold">Configuração do Projeto</h3>

        <div className="space-y-2">
          <Label>Projeto</Label>
          {projects.length === 0 ? (
            <div className="text-sm text-muted-foreground p-3 border border-amber-500/50 bg-amber-500/10 rounded">
              Nenhum projeto configurado. Crie um em <a href="/projects" className="underline">/projects</a>.
            </div>
          ) : (
            <Select value={selectedProjectId || undefined} onValueChange={onProjectChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um projeto" />
              </SelectTrigger>
              <SelectContent>
                {projects.filter((p) => p.isActive).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.workspace?.name} / {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={taskType} onValueChange={onTaskTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Opcional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="feature">Feature</SelectItem>
              <SelectItem value="bugfix">Bugfix</SelectItem>
              <SelectItem value="refactor">Refactor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ─── LLM Config por Etapa ─────────────────────────────────────── */}
      <div className="space-y-3 p-4 border rounded-lg">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">LLMs por Etapa</h3>
          <span className="text-[10px] text-muted-foreground font-medium px-1.5 py-0.5 bg-muted rounded">
            Sessões isoladas
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Cada etapa roda em sessão independente. Você pode usar o mesmo ou diferentes modelos por etapa.
        </p>

        <div className="space-y-3">
          {phaseDefaults
            .slice()
            .sort((a, b) => a.step - b.step)
            .map((phase) => {
              const s = phase.step
              const label = generateStepLabel(s)
              const desc = generateStepDescription(s)
              const cfg = stepLLMs[s] ?? getDefault(s)

            return (
              <div key={s} className="space-y-1.5 p-2.5 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{label}</span>
                  <span className="text-[10px] text-muted-foreground">{desc}</span>
                </div>
                <Select value={cfg.provider} onValueChange={(v) => onStepLLMChange(s, "provider", v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(providerModels).map(([key, c]) => (
                      <SelectItem key={key} value={key}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={cfg.model} onValueChange={(v) => onStepLLMChange(s, "model", v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(providerModels[cfg.provider]?.models || []).map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── Rerun Picker ─────────────────────────────────────── */}
      {diskArtifacts.length > 0 && (
        <div className="space-y-3 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Revalidar artefatos existentes</p>
              <p className="text-xs text-muted-foreground">Pular geração — usar artifacts do disco (microplans.json ou plan.json). Zero tokens.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleRerunPicker}
            >
              {showRerunPicker ? "Fechar" : `${diskArtifacts.length} disponíveis →`}
            </Button>
          </div>
          {showRerunPicker && (
            <div className="space-y-1 max-h-48 overflow-auto rounded border p-2">
              {diskArtifacts.map((af) => {
                const date = new Date(af.createdAt)
                const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                const shortId = af.outputId.length > 50 ? af.outputId.slice(0, 50) + "…" : af.outputId
                return (
                  <button
                    key={af.outputId}
                    disabled={rerunLoading || loading}
                    className="w-full text-left px-3 py-2 rounded hover:bg-muted/50 transition-colors flex items-center justify-between gap-2 text-xs disabled:opacity-50"
                    onClick={async () => {
                      await onRerunFromDisk(af.outputId)
                    }}
                  >
                    <span className="font-mono truncate flex-1">{shortId}</span>
                    <span className="text-muted-foreground shrink-0">{dateStr}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {af.hasSpec ? "plan+spec" : "plan"}
                    </Badge>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Logs Drawer Button ─────────────────────────────────────── */}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={onOpenLogs}
      >
        <span className="mr-2">📋</span>
        View Execution Logs
        {logsCount > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {logsCount}
          </Badge>
        )}
      </Button>
    </div>
  )
}

// Componente principal com lógica responsiva
export function ContextPanel(props: ContextPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Mobile: Bottom sheet
  if (isMobile) {
    return (
      <>
        {/* Toggle button (floating FAB) */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            position: 'fixed',
            bottom: '16px',
            right: '16px',
            zIndex: 50,
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
          }}
          aria-label="Abrir configurações"
        >
          ⚙️
        </button>

        {/* Bottom sheet */}
        {isOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              background: 'rgba(0,0,0,0.5)',
            }}
            onClick={() => setIsOpen(false)}
          >
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                maxHeight: '80vh',
                background: 'var(--background)',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
                padding: '24px',
                overflowY: 'auto',
                animation: 'slideUp 0.3s ease-out',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close handle */}
              <div
                style={{
                  width: '40px',
                  height: '4px',
                  background: 'var(--muted-foreground)',
                  borderRadius: '2px',
                  margin: '0 auto 16px',
                  opacity: 0.3,
                }}
              />
              <PanelContent {...props} />
            </div>
          </div>
        )}
      </>
    )
  }

  // Desktop: Sticky panel (comportamento padrão)
  return <PanelContent {...props} />
}
