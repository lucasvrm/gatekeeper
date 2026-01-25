import { useMemo, useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import type { ArtifactInputMode, CreateRunRequest, LLMPlanOutput, Project } from "@/lib/types"
import { ArtifactsInput, type ArtifactsLoadedData } from "@/components/artifacts-input"
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

export function NewValidationPage() {
  const navigate = useNavigate()
  const [planData, setPlanData] = useState<LLMPlanOutput | null>(null)
  const [planJsonContent, setPlanJsonContent] = useState<string | null>(null)
  const [specFileName, setSpecFileName] = useState<string | null>(null)
  const [specContent, setSpecContent] = useState<string | null>(null)
  const [inputMode, setInputMode] = useState<ArtifactInputMode | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await api.projects.list(1, 100)
        setProjects(response.data)
        // Auto-select first active project
        const activeProjects = response.data.filter(p => p.isActive)
        if (activeProjects.length > 0 && !selectedProjectId) {
          setSelectedProjectId(activeProjects[0].id)
        }
      } catch (error) {
        console.error("Failed to load projects:", error)
      }
    }
    loadProjects()
  }, [selectedProjectId])

  const canSubmit = useMemo(() => {
    if (!planData) return false
    if (!inputMode) return false
    if (inputMode === "upload") {
      return Boolean(specFileName && specContent && planJsonContent)
    }
    return true
  }, [inputMode, planData, planJsonContent, specContent, specFileName])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!planData) {
      setError("Carregue um JSON valido antes de enviar")
      return
    }

    if (!canSubmit) {
      setError("Carregue os artifacts antes de enviar")
      return
    }

    setIsSubmitting(true)
    try {
      if (!selectedProjectId) {
        setError("Selecione um projeto antes de enviar")
        setIsSubmitting(false)
        return
      }

      const requestData = {
        outputId: planData.outputId,
        baseRef: planData.baseRef,
        targetRef: planData.targetRef,
        taskPrompt: planData.taskPrompt,
        dangerMode: planData.dangerMode,
        manifest: planData.manifest,
        contract: planData.contract,
        runType: 'CONTRACT',
        projectId: selectedProjectId,
      } satisfies CreateRunRequest

      // Step 1: Create run (stays in PENDING, not added to queue yet)
      const response = await api.runs.create(requestData)

      // Step 2: Upload files or trigger filesystem mode
      if (inputMode === "upload" && planJsonContent && specContent && specFileName) {
        const formData = new FormData()

        const planBlob = new Blob([planJsonContent], { type: 'application/json' })
        formData.append('planJson', planBlob, 'plan.json')

        const specBlob = new Blob([specContent], { type: 'text/plain' })
        formData.append('specFile', specBlob, specFileName)

        await api.runs.uploadFiles(response.runId, formData)
      } else {
        const emptyFormData = new FormData()
        await api.runs.uploadFiles(response.runId, emptyFormData)
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

  const handleArtifactsLoaded = (data: ArtifactsLoadedData) => {
    setPlanData(data.planData)
    try {
      setPlanJsonContent(JSON.stringify(data.planData))
    } catch {
      setPlanJsonContent(null)
    }
    setSpecContent(data.specContent)
    setSpecFileName(data.specFileName)
    setInputMode(data.inputMode)
    setError(null)
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
                Projeto (Obrigatório)
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Selecione o projeto para validação. O projeto define o workspace e o caminho raiz.
              </p>
            </div>
            {projects.length === 0 ? (
              <div className="text-sm text-muted-foreground p-3 border border-amber-500/50 bg-amber-500/10 rounded">
                ⚠️ Nenhum projeto configurado. Crie um projeto em /config primeiro.
              </div>
            ) : (
              <Select
                value={selectedProjectId || undefined}
                onValueChange={setSelectedProjectId}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um projeto" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.workspace?.name} / {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
                    Artifacts Input
                  </Label>
                </div>
                <ArtifactsInput
                  projectId={selectedProjectId}
                  onArtifactsLoaded={handleArtifactsLoaded}
                  onError={(message) => setError(message)}
                />
              </div>
            </Card>
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              data-testid="btn-run-gates-top"
              className="w-full"
            >
              {isSubmitting ? "Iniciando..." : "Run Gates 0 e 1"}
            </Button>
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
