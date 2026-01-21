import { useMemo, useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import type { LLMPlanOutput, ManifestFile, Project } from "@/lib/types"
import { FileDropZone } from "@/components/file-drop-zone"
import { TestFileInput } from "@/components/test-file-input"
import { JsonPreview } from "@/components/json-preview"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { ArrowLeft } from "@phosphor-icons/react"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  const [planJsonContent, setPlanJsonContent] = useState<string | null>(null)
  const [testFileMode, setTestFileMode] = useState<"upload" | "manual">("upload")
  const [manualTestPath, setManualTestPath] = useState("")
  const [uploadedTestPath, setUploadedTestPath] = useState("")
  const [uploadedTestContent, setUploadedTestContent] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runType, setRunType] = useState<'CONTRACT' | 'EXECUTION'>('CONTRACT')
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>("__NONE__")

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await api.projects.list(1, 100)
        setProjects(response.data)
      } catch (error) {
        console.error("Failed to load projects:", error)
      }
    }
    loadProjects()
  }, [])

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
        setPlanJsonContent(null)
        setError("JSON invalido: estrutura inesperada")
        return
      }
      setPlanData(parsed)
      setPlanJsonContent(content)
    } catch {
      setPlanData(null)
      setPlanJsonContent(null)
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
        baseRef: planData.baseRef,
        targetRef: planData.targetRef,
        taskPrompt: planData.taskPrompt,
        dangerMode: planData.dangerMode,
        manifest: planData.manifest,
        contract: planData.contract,
        runType,
        ...(selectedProjectId !== "__NONE__" && { projectId: selectedProjectId }),
      }

      // Step 1: Create run (stays in PENDING, not added to queue yet)
      const response = await api.runs.create(requestData)

      // Step 2: Upload files if available
      if (testFileMode === "upload" && planJsonContent && uploadedTestContent && uploadedTestPath) {
        const formData = new FormData()

        // Add plan.json
        const planBlob = new Blob([planJsonContent], { type: 'application/json' })
        formData.append('planJson', planBlob, 'plan.json')

        // Add spec file
        const specBlob = new Blob([uploadedTestContent], { type: 'text/plain' })
        formData.append('specFile', specBlob, uploadedTestPath)

        // Upload files (this will queue the run for execution)
        await api.runs.uploadFiles(response.runId, formData)
      }

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

  const handleTestFilePath = (filename: string, content?: string) => {
    setTestFileMode("upload")
    setUploadedTestPath(filename)
    setUploadedTestContent(content || null)
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
    <div className="p-8 space-y-6">
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
        <Card className="p-6 bg-card border-border">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium uppercase tracking-wider">
                Projeto (Opcional)
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Selecione um projeto para usar suas configurações de workspace. Se não selecionado, usará as configurações globais.
              </p>
            </div>
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Usar configurações globais" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__NONE__">Usar configurações globais</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.workspace?.name} / {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

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

        <div className="flex items-center justify-start gap-3">
          <Button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            data-testid="btn-run-gates"
          >
            {isSubmitting ? "Iniciando..." : "Run Gates 0 e 1"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/runs")} data-testid="btn-cancel">
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
