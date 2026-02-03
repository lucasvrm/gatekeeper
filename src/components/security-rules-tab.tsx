import { ConfigSection } from "@/components/config-section"
import { type ConfigModalField } from "@/components/config-modal"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface SensitiveFileRule {
  id: string
  pattern: string
  category: string
  severity: string
  description?: string | null
  isActive: boolean
}

interface AmbiguousTerm {
  id: string
  term: string
  category: string
  suggestion?: string | null
  isActive: boolean
}

interface SecurityRulesTabProps {
  sensitiveFileRules: SensitiveFileRule[]
  ambiguousTerms: AmbiguousTerm[]
  onCreateSensitiveRule: (data: Partial<SensitiveFileRule>) => Promise<void>
  onUpdateSensitiveRule: (id: string, data: Partial<SensitiveFileRule>) => Promise<void>
  onDeleteSensitiveRule: (id: string) => Promise<void>
  onCreateAmbiguousTerm: (data: Partial<AmbiguousTerm>) => Promise<void>
  onUpdateAmbiguousTerm: (id: string, data: Partial<AmbiguousTerm>) => Promise<void>
  onDeleteAmbiguousTerm: (id: string) => Promise<void>
}

const sensitiveCreateFields: ConfigModalField[] = [
  { name: "pattern", label: "Pattern", type: "text", required: true },
  { name: "category", label: "Categoria", type: "text", required: true },
  { name: "severity", label: "Severidade", type: "text", required: true },
  { name: "description", label: "Descrição", type: "textarea" },
  { name: "isActive", label: "Ativo", type: "boolean" },
]

const sensitiveEditFields = sensitiveCreateFields

const ambiguousCreateFields: ConfigModalField[] = [
  { name: "term", label: "Termo", type: "text", required: true },
  { name: "category", label: "Categoria", type: "text", required: true },
  { name: "suggestion", label: "Sugestão", type: "textarea" },
  { name: "isActive", label: "Ativo", type: "boolean" },
]

const ambiguousEditFields = ambiguousCreateFields

export function SecurityRulesTab({
  sensitiveFileRules,
  ambiguousTerms,
  onCreateSensitiveRule,
  onUpdateSensitiveRule,
  onDeleteSensitiveRule,
  onCreateAmbiguousTerm,
  onUpdateAmbiguousTerm,
  onDeleteAmbiguousTerm,
}: SecurityRulesTabProps) {
  const handleCreateSensitive = async (values: Record<string, string | boolean>) => {
    await onCreateSensitiveRule({
      pattern: String(values.pattern ?? ""),
      category: String(values.category ?? ""),
      severity: String(values.severity ?? ""),
      description: typeof values.description === "string" ? values.description : undefined,
      isActive: typeof values.isActive === "boolean" ? values.isActive : true,
    })
    return true
  }

  const handleUpdateSensitive = async (id: string, values: Record<string, string | boolean>) => {
    await onUpdateSensitiveRule(id, {
      pattern: String(values.pattern ?? ""),
      category: String(values.category ?? ""),
      severity: String(values.severity ?? ""),
      description: typeof values.description === "string" ? values.description : null,
      isActive: typeof values.isActive === "boolean" ? values.isActive : undefined,
    })
    return true
  }

  const handleDeleteSensitive = async (id: string) => {
    await onDeleteSensitiveRule(id)
    return true
  }

  const handleToggleSensitive = async (id: string, isActive: boolean) => {
    await onUpdateSensitiveRule(id, { isActive })
    return true
  }

  const handleCreateAmbiguous = async (values: Record<string, string | boolean>) => {
    await onCreateAmbiguousTerm({
      term: String(values.term ?? ""),
      category: String(values.category ?? ""),
      suggestion: typeof values.suggestion === "string" ? values.suggestion : undefined,
      isActive: typeof values.isActive === "boolean" ? values.isActive : true,
    })
    return true
  }

  const handleUpdateAmbiguous = async (id: string, values: Record<string, string | boolean>) => {
    await onUpdateAmbiguousTerm(id, {
      term: String(values.term ?? ""),
      category: String(values.category ?? ""),
      suggestion: typeof values.suggestion === "string" ? values.suggestion : null,
      isActive: typeof values.isActive === "boolean" ? values.isActive : undefined,
    })
    return true
  }

  const handleDeleteAmbiguous = async (id: string) => {
    await onDeleteAmbiguousTerm(id)
    return true
  }

  const handleToggleAmbiguous = async (id: string, isActive: boolean) => {
    await onUpdateAmbiguousTerm(id, { isActive })
    return true
  }

  return (
    <div className="space-y-6">
      {/* Sensitive File Patterns Section */}
      <Card data-testid="sensitive-file-patterns-section">
        <CardHeader>
          <CardTitle>Sensitive File Patterns</CardTitle>
          <CardDescription>
            Padrões de arquivos sensíveis que não devem ser modificados ou expostos.
            <br />
            <span className="text-xs text-muted-foreground mt-1 inline-block">
              Usado por: <code className="bg-muted px-1 rounded">SensitiveFilesLock</code>, <code className="bg-muted px-1 rounded">DangerModeExplicit</code>
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfigSection
            title=""
            description=""
            items={sensitiveFileRules}
            columns={[
              { key: "pattern", label: "Pattern" },
              { key: "category", label: "Categoria" },
              { key: "severity", label: "Severidade" },
              {
                key: "isActive",
                label: "Status",
                render: (item) => (
                  <Badge variant={item.isActive ? "default" : "secondary"}>
                    {item.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                ),
              },
            ]}
            createFields={sensitiveCreateFields}
            editFields={sensitiveEditFields}
            createDefaults={{
              pattern: "",
              category: "",
              severity: "",
              description: "",
              isActive: true,
            }}
            getEditValues={(item) => ({
              pattern: item.pattern,
              category: item.category,
              severity: item.severity,
              description: item.description ?? "",
              isActive: item.isActive,
            })}
            onCreate={handleCreateSensitive}
            onUpdate={handleUpdateSensitive}
            onDelete={handleDeleteSensitive}
            onToggle={handleToggleSensitive}
          />
        </CardContent>
      </Card>

      {/* Ambiguous Terms Detection Section */}
      <Card data-testid="ambiguous-terms-section">
        <CardHeader>
          <CardTitle>Ambiguous Terms Detection</CardTitle>
          <CardDescription>
            Termos que indicam ambiguidade ou falta de clareza nas tarefas.
            <br />
            <span className="text-xs text-muted-foreground mt-1 inline-block">
              Usado por: <code className="bg-muted px-1 rounded">TaskClarityCheck</code>
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfigSection
            title=""
            description=""
            items={ambiguousTerms}
            columns={[
              { key: "term", label: "Termo" },
              { key: "category", label: "Categoria" },
              {
                key: "suggestion",
                label: "Sugestão",
                render: (item) => item.suggestion ?? "-",
              },
              {
                key: "isActive",
                label: "Status",
                render: (item) => (
                  <Badge variant={item.isActive ? "default" : "secondary"}>
                    {item.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                ),
              },
            ]}
            createFields={ambiguousCreateFields}
            editFields={ambiguousEditFields}
            createDefaults={{
              term: "",
              category: "",
              suggestion: "",
              isActive: true,
            }}
            getEditValues={(item) => ({
              term: item.term,
              category: item.category,
              suggestion: item.suggestion ?? "",
              isActive: item.isActive,
            })}
            onCreate={handleCreateAmbiguous}
            onUpdate={handleUpdateAmbiguous}
            onDelete={handleDeleteAmbiguous}
            onToggle={handleToggleAmbiguous}
          />
        </CardContent>
      </Card>
    </div>
  )
}
