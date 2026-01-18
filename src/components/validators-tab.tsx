import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
}

const VALIDATOR_DESCRIPTIONS: Record<string, string> = {
  'TOKEN_BUDGET_FIT': 'Verifica se o tamanho do contexto (arquivos + prompt) cabe dentro do orçamento de tokens configurado',
  'TASK_SCOPE_SIZE': 'Garante que a tarefa não envolva muitos arquivos além do limite permitido',
  'TASK_CLARITY_CHECK': 'Valida se a descrição da tarefa é clara e não contém termos ambíguos',
  'SENSITIVE_FILES_LOCK': 'Bloqueia alterações em arquivos sensíveis (env, migrations, secrets, CI/CD)',
  'DANGER_MODE_EXPLICIT': 'Exige que danger mode seja explicitamente habilitado quando arquivos sensíveis são modificados',
  'CONTRACT_SCHEMA_VALID': 'Valida a estrutura do contrato (schema, clauses e assertion surface)',
  'TEST_CLAUSE_MAPPING_VALID': 'Verifica se cada teste/tag referencia clauseId existente no contrato',
  'CONTRACT_CLAUSE_COVERAGE': 'Garante cobertura das cláusulas críticas conforme o contrato',
  'NO_OUT_OF_CONTRACT_ASSERTIONS': 'Impede asserts fora do assertionSurface declarado no contrato',
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
  return (
    <Card className="p-6 bg-card border-border space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Validators</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Toggle validator enforcement for Gatekeeper checks.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Badge variant="default">Active {activeCount}</Badge>
          <Badge variant="secondary">Inactive {inactiveCount}</Badge>
        </div>
      </div>

      {validators.length === 0 ? (
        <div className="text-sm text-muted-foreground">No validators found.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs uppercase tracking-wide">Validator</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Descrição</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Status</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {validators.map((validator) => {
              const isActive = validator.value === "true"
              const description = VALIDATOR_DESCRIPTIONS[validator.key] || 'Sem descrição disponível'
              return (
                <TableRow key={validator.key}>
                  <TableCell className="font-medium">{validator.key}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-md">
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
