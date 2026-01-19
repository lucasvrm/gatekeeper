import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import type { LLMPlanOutput, ManifestFile } from "@/lib/types"
import { FileDropZone } from "@/components/file-drop-zone"
import { TestFileInput } from "@/components/test-file-input"
import { JsonPreview } from "@/components/json-preview"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { ArrowLeft } from "@phosphor-icons/react"
import { toast } from "sonner"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isManifestFile = (value: unknown): value is ManifestFile => {
  if (!isRecord(value)) return false
  const action = value.action
  const hasAction =
    action === "CREATE" || action === "MODIFY" || action === "DELETE"
  const hasReason = value.reason === undefined || typeof value.reason === "string"
  return (
    typeof value.path === "string" &&
    value.path.length > 0 &&
    hasAction &&
    hasReason
  )
}

const isLLMPlanOutput = (value: unknown): value is LLMPlanOutput => {
  if (!isRecord(value)) return false
  const manifest = value.manifest
  if (!isRecord(manifest)) return false

  const files = manifest.files
  const hasFilesArray = Array.isArray(files) && files.every(isManifestFile)
  const hasManifestTestFile =
    typeof manifest.testFile === "string" && manifest.testFile.length > 0

  return (
    typeof value.outputId === "string" &&
    value.outputId.length > 0 &&
    typeof value.projectPath === "string" &&
    value.projectPath.length > 0 &&
    typeof value.baseRef === "string" &&
    value.baseRef.length > 0 &&
    typeof value.targetRef === "string" &&
    value.targetRef.length > 0 &&
    typeof value.taskPrompt === "string" &&
    value.taskPrompt.length > 0 &&
    typeof value.dangerMode === "boolean" &&
    hasFilesArray &&
    hasManifestTestFile
  )
}

export function NewValidationPage() {
  const navigate = useNavigate()
  const [planData, setPlanData] = useState<LLMPlanOutput | null>(null)
  const [testFileMode, setTestFileMode] = useState<"upload" | "manual">("upload")
  const [manualTestPath, setManualTestPath] = useState("")
  const [uploadedTestPath, setUploadedTestPath] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runType, setRunType] = useState<'CONTRACT' | 'EXECUTION'>('CONTRACT')

  const canSubmit = useMemo(() => {
    if (!planData) return false
    if (testFileMode === "upload") {
      return Boolean(uploadedTestPath)
    }
    return Boolean(manualTestPath)
  }, [manualTestPath, planData, testFileMode, uploadedTestPath])

  const handleJsonContent = (content: string) => {
    setError(null)
    try {
      const parsed = JSON.parse(content)
      if (!isLLMPlanOutput(parsed)) {
        setPlanData(null)
        setError("JSON invalido: estrutura inesperada")
        return
      }
      setPlanData(parsed)
    } catch {
      setPlanData(null)
      setError("JSON invalido: falha ao interpretar")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!planData) {
      setError("Carregue um JSON valido antes de enviar")
      return
    }

    if (!canSubmit) {
      setError("Informe o arquivo de teste ou o caminho manual")
      return
    }

    setIsSubmitting(true)
    try {
      const requestData = {
        outputId: planData.outputId,
        projectPath: planData.projectPath,
        baseRef: planData.baseRef,
        targetRef: planData.targetRef,
        taskPrompt: planData.taskPrompt,
        dangerMode: planData.dangerMode,
        manifest: planData.manifest,
        runType,
      }

      const response = await api.runs.create(requestData)
      toast.success("Validacao iniciada com sucesso")
      navigate(`/runs/${response.runId}`)
    } catch (error) {
      console.error("Failed to create run:", error)
      setError("Falha ao iniciar validacao")
      toast.error("Falha ao iniciar validacao")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTestFilePath = (filename: string) => {
    setTestFileMode("upload")
    setUploadedTestPath(filename)
    setManualTestPath("")
    setError(null)
  }

  const handleManualPath = (path: string) => {
      if (path) {
        setTestFileMode("manual")
        setManualTestPath(path)
        setUploadedTestPath("")
      } else {
        setManualTestPath("")
      }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/runs")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para Runs
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Nova Validacao</h1>
        <p className="text-muted-foreground mt-1">Carregue o plano e o teste</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div
          className={`grid gap-6 lg:grid-cols-[1.1fr_0.9fr] ${
            isSubmitting ? "pointer-events-none opacity-70" : ""
          }`}
        >
          <div className="space-y-6">
            <Card className="p-6 bg-card border-border">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium uppercase tracking-wider">
                    JSON Input
                  </Label>
                </div>
                <FileDropZone
                  accept=".json"
                  label="Upload do JSON"
                  placeholder="Arraste ou clique para selecionar o JSON"
                  onFileContent={(content) => handleJsonContent(content)}
                  onError={(message) => setError(message)}
                />
              </div>
            </Card>

            <Card className="p-6 bg-card border-border space-y-4">
              <div>
                <Label className="text-sm font-medium uppercase tracking-wider">
                  Teste
                </Label>
              </div>
              <TestFileInput
                onFilePath={handleTestFilePath}
                onPathManual={handleManualPath}
                onError={(message) => setError(message)}
              />
            </Card>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium uppercase tracking-wider">
                Preview
              </Label>
              <JsonPreview data={planData} />
            </div>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate("/runs")}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            onClick={() => setRunType('CONTRACT')}
          >
            {isSubmitting && runType === 'CONTRACT' ? "Iniciando..." : "Validar Contrato (Gates 0-1)"}
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            onClick={() => setRunType('EXECUTION')}
          >
            {isSubmitting && runType === 'EXECUTION' ? "Iniciando..." : "Validar Execução (Gates 2-3)"}
          </Button>
        </div>
      </form>
    </div>
  )
}
