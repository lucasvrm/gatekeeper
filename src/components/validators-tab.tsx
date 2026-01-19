import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ValidatorItem = {
  key: string
  value: string
  gateCategory?: string
}

type ValidatorCategory = {
  key: string
  label: string
  description: string
  validators: string[]
}

const VALIDATOR_CATEGORIES: ValidatorCategory[] = [
  {
    key: "INPUT_BUDGET",
    label: "INPUT_BUDGET",
    description: "Limites de tamanho/quantidade",
    validators: ["TOKEN_BUDGET_FIT", "TASK_SCOPE_SIZE"],
  },
  {
    key: "INPUT_QUALITY",
    label: "INPUT_QUALITY",
    description: "Clareza e especificidade do input",
    validators: ["TASK_CLARITY_CHECK", "NO_IMPLICIT_FILES"],
  },
  {
    key: "MANIFEST_STRUCTURE",
    label: "MANIFEST_STRUCTURE",
    description: "Estrutura e validade do manifest",
    validators: ["MANIFEST_FILE_LOCK"],
  },
  {
    key: "SECURITY_POLICY",
    label: "SECURITY_POLICY",
    description: "Arquivos sensíveis e danger mode",
    validators: ["SENSITIVE_FILES_LOCK", "DANGER_MODE_EXPLICIT"],
  },
  {
    key: "TEST_STRUCTURE",
    label: "TEST_STRUCTURE",
    description: "Análise estática do código de teste",
    validators: [
      "TEST_SYNTAX_VALID",
      "TEST_HAS_ASSERTIONS",
      "TEST_COVERS_HAPPY_AND_SAD_PATH",
      "NO_DECORATIVE_TESTS",
      "IMPORT_REALITY_CHECK",
      "TEST_INTENT_ALIGNMENT",
    ],
  },
  {
    key: "TDD_ENFORCEMENT",
    label: "TDD_ENFORCEMENT",
    description: "Cláusula Pétrea (red-green-refactor)",
    validators: ["TEST_FAILS_BEFORE_IMPLEMENTATION"],
  },
  {
    key: "SCOPE_DISCIPLINE",
    label: "SCOPE_DISCIPLINE",
    description: "Disciplina de escopo pós-contrato",
    validators: ["DIFF_SCOPE_ENFORCEMENT", "TEST_READ_ONLY_ENFORCEMENT"],
  },
  {
    key: "CODE_QUALITY",
    label: "CODE_QUALITY",
    description: "Ferramentas de qualidade (tsc, eslint)",
    validators: ["STRICT_COMPILATION", "STYLE_CONSISTENCY_LINT"],
  },
  {
    key: "TEST_EXECUTION",
    label: "TEST_EXECUTION",
    description: "Execução de testes",
    validators: ["TASK_TEST_PASSES", "FULL_REGRESSION_PASS"],
  },
  {
    key: "BUILD_INTEGRITY",
    label: "BUILD_INTEGRITY",
    description: "Build de produção",
    validators: ["PRODUCTION_BUILD_PASS"],
  },
]

const VALIDATOR_CATEGORY_LOOKUP = new Map<
  string,
  { key: string; label: string; description: string }
>(
  VALIDATOR_CATEGORIES.flatMap((category) =>
    category.validators.map((validator) => [
      validator,
      {
        key: category.key,
        label: category.label,
        description: category.description,
      },
    ]),
  ),
)

const VALIDATOR_DESCRIPTIONS: Record<string, string> = {
  'TOKEN_BUDGET_FIT': 'Verifica se o tamanho do contexto (arquivos + prompt) cabe dentro do orçamento de tokens configurado',
  'TASK_SCOPE_SIZE': 'Garante que a tarefa não envolva muitos arquivos além do limite permitido',
  'TASK_CLARITY_CHECK': 'Valida se a descrição da tarefa é clara e não contém termos ambíguos',
  'SENSITIVE_FILES_LOCK': 'Bloqueia alterações em arquivos sensíveis (env, migrations, secrets, CI/CD)',
  'DANGER_MODE_EXPLICIT': 'Exige que danger mode seja explicitamente habilitado quando arquivos sensíveis são modificados',
  'TEST_SYNTAX_VALID': 'Verifica se o arquivo de teste possui sintaxe válida e pode ser parseado',
  'TEST_HAS_ASSERTIONS': 'Garante que o teste contenha pelo menos uma assertion (expect, assert, toBe, etc)',
  'TEST_COVERS_HAPPY_AND_SAD_PATH': 'Valida se o teste cobre tanto casos de sucesso quanto casos de erro',
  'TEST_FAILS_BEFORE_IMPLEMENTATION': 'Verifica se o teste falha antes da implementação (TDD red phase)',
  'NO_DECORATIVE_TESTS': 'Bloqueia testes decorativos que apenas chamam código sem validar comportamento',
  'MANIFEST_FILE_LOCK': 'Garante que apenas arquivos declarados no manifest sejam modificados',
  'NO_IMPLICIT_FILES': 'Proíbe modificações em arquivos não listados explicitamente no manifest',
  'IMPORT_REALITY_CHECK': 'Valida se os imports no código realmente existem e estão disponíveis',
  'TEST_INTENT_ALIGNMENT': 'Verifica se o teste está alinhado com a intenção da tarefa descrita no prompt',
  'DIFF_SCOPE_ENFORCEMENT': 'Garante que as mudanças no diff estão dentro do escopo declarado no manifest',
  'TEST_READ_ONLY_ENFORCEMENT': 'Valida que o arquivo de teste não modifica estado global ou cria side-effects',
  'TASK_TEST_PASSES': 'Executa o teste da tarefa e verifica se ele passa após a implementação',
  'STRICT_COMPILATION': 'Compila o código em modo strict e verifica se não há erros de tipo',
  'STYLE_CONSISTENCY_LINT': 'Executa linter para garantir consistência de estilo e boas práticas',
  'FULL_REGRESSION_PASS': 'Executa toda a suíte de testes de regressão do projeto',
  'PRODUCTION_BUILD_PASS': 'Realiza build de produção e verifica se não há erros de compilação',
}

interface ValidatorsTabProps {
  validators: ValidatorItem[]
  actionId: string | null
  activeCount: number
  inactiveCount: number
  onToggle: (name: string, isActive: boolean) => void | Promise<void>
}

export function ValidatorsTab({
  validators,
  actionId,
  activeCount,
  inactiveCount,
  onToggle,
}: ValidatorsTabProps) {
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")

  const enrichedValidators = useMemo(() => {
    return validators.map((validator) => {
      const category = VALIDATOR_CATEGORY_LOOKUP.get(validator.key)
      return {
        ...validator,
        categoryKey: category?.key ?? "UNKNOWN",
        categoryLabel: category?.label ?? validator.gateCategory ?? "—",
        categoryDescription: category?.description ?? "",
      }
    })
  }, [validators])

  const filteredValidators = useMemo(() => {
    return enrichedValidators.filter((validator) => {
      if (categoryFilter !== "ALL" && validator.categoryKey !== categoryFilter) {
        return false
      }
      if (statusFilter === "ACTIVE" && validator.value !== "true") {
        return false
      }
      if (statusFilter === "INACTIVE" && validator.value === "true") {
        return false
      }
      return true
    })
  }, [categoryFilter, enrichedValidators, statusFilter])

  return (
    <Card className="p-6 bg-card border-border space-y-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Validators</h2>
          <div className="flex flex-wrap items-center gap-3 justify-end">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Categoria</span>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas categorias</SelectItem>
                  {VALIDATOR_CATEGORIES.map((category) => (
                    <SelectItem key={category.key} value={category.key}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Status</span>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "ALL" | "ACTIVE" | "INACTIVE")}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos status</SelectItem>
                  <SelectItem value="ACTIVE">Ativo</SelectItem>
                  <SelectItem value="INACTIVE">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Toggle validator enforcement for Gatekeeper checks.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Badge variant="default">Active {activeCount}</Badge>
          <Badge variant="secondary">Inactive {inactiveCount}</Badge>
        </div>
      </div>

      {filteredValidators.length === 0 ? (
        <div className="text-sm text-muted-foreground">No validators found.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs uppercase tracking-wide">Validator</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Categoria</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Descrição</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Status</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredValidators.map((validator) => {
              const isActive = validator.value === "true"
              const description = VALIDATOR_DESCRIPTIONS[validator.key] || 'Sem descrição disponível'
              return (
                <TableRow key={validator.key}>
                  <TableCell className="font-medium">{validator.key}</TableCell>
                  <TableCell className="text-sm text-muted-foreground" title={validator.categoryDescription}>
                    {validator.categoryLabel}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-md whitespace-normal break-words">
                    {description}
                  </TableCell>
                  <TableCell>
                    <Badge variant={isActive ? "default" : "secondary"}>
                      {isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={isActive ? "secondary" : "outline"}
                      onClick={() => onToggle(validator.key, !isActive)}
                      disabled={actionId === validator.key}
                    >
                      {isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}
