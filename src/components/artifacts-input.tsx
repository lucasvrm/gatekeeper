import { useEffect, useMemo, useState } from "react"
import { api } from "@/lib/api"
import type { ArtifactFolder, ArtifactInputMode, LLMPlanOutput } from "@/lib/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileDropZone } from "@/components/file-drop-zone"

export interface ArtifactsLoadedData {
  planData: LLMPlanOutput
  specContent: string
  specFileName: string
  outputId: string
  inputMode: ArtifactInputMode
}

interface ArtifactsInputProps {
  projectId: string | null
  onArtifactsLoaded: (data: ArtifactsLoadedData) => void
  onError?: (message: string) => void
}

const safeString = (value: unknown) => (typeof value === "string" ? value : "")

export function ArtifactsInput({ projectId, onArtifactsLoaded, onError }: ArtifactsInputProps) {
  const [activeTab, setActiveTab] = useState<ArtifactInputMode>("dropdown")
  const [folders, setFolders] = useState<ArtifactFolder[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [planContent, setPlanContent] = useState<string | null>(null)
  const [planFileName, setPlanFileName] = useState<string | null>(null)
  const [specContent, setSpecContent] = useState<string | null>(null)
  const [specFileName, setSpecFileName] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) {
      setFolders([])
      return
    }

    api.artifacts.list(projectId)
      .then(setFolders)
      .catch((error) => {
        console.error("Failed to load artifacts:", error)
        setFolders([])
        onError?.(error instanceof Error ? error.message : "Falha ao carregar artifacts")
      })
  }, [projectId, onError])

  const filteredFolders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return folders
    return folders.filter((folder) => folder.outputId.toLowerCase().includes(query))
  }, [folders, searchQuery])

  const handleArtifactsSelection = async (outputId: string, inputMode: ArtifactInputMode) => {
    if (!projectId || !outputId) return
    try {
      const contents = await api.artifacts.getContents(projectId, outputId)
      if (!contents.planJson || !contents.specContent || !contents.specFileName) {
        onError?.("Conteudo incompleto na pasta de artifacts")
        return
      }
      onArtifactsLoaded({
        planData: contents.planJson as LLMPlanOutput,
        specContent: contents.specContent,
        specFileName: contents.specFileName,
        outputId,
        inputMode,
      })
    } catch (error) {
      console.error("Failed to load artifact contents:", error)
      onError?.(error instanceof Error ? error.message : "Falha ao carregar conteudo do artifact")
    }
  }

  useEffect(() => {
    if (!planContent || !specContent || !specFileName) return

    try {
      const parsed = JSON.parse(planContent) as LLMPlanOutput
      const outputId = safeString(parsed.outputId) || "upload"

      onArtifactsLoaded({
        planData: parsed,
        specContent,
        specFileName,
        outputId,
        inputMode: "upload",
      })
    } catch (error) {
      console.error("Failed to parse plan.json:", error)
      onError?.("plan.json invalido")
    }
  }, [planContent, specContent, specFileName, onArtifactsLoaded, onError])

  return (
    <div data-testid="artifacts-input-tabs" className="space-y-4">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ArtifactInputMode)}>
        <TabsList>
          <TabsTrigger value="dropdown" aria-label="Selecionar pasta">
            Selecionar
          </TabsTrigger>
          <TabsTrigger value="autocomplete" aria-label="Buscar pasta">
            Buscar
          </TabsTrigger>
          <TabsTrigger value="upload" aria-label="Upload de arquivos">
            Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dropdown" className="space-y-3">
          <label className="text-sm text-muted-foreground">Selecione uma pasta de artifacts</label>
          <select
            data-testid="artifacts-dropdown"
            role="listbox"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            onChange={(event) => handleArtifactsSelection(event.target.value, "dropdown")}
          >
            <option value="">Selecione uma pasta</option>
            {folders.map((folder) => {
              const isComplete = folder.hasPlan && folder.hasSpec
              return (
                <option
                  key={folder.outputId}
                  value={folder.outputId}
                  role="option"
                  disabled={!isComplete}
                >
                  {folder.outputId}
                  {!isComplete ? " (incompleto)" : ""}
                </option>
              )
            })}
          </select>
        </TabsContent>

        <TabsContent value="autocomplete" className="space-y-3">
          <label className="text-sm text-muted-foreground">Busque pelo outputId</label>
          <input
            data-testid="artifacts-autocomplete-input"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Digite para buscar..."
          />
          {searchQuery.trim().length > 0 && (
            <ul role="listbox" className="space-y-1">
              {filteredFolders.map((folder) => (
                <li key={folder.outputId}>
                  <button
                    type="button"
                    role="option"
                    className="w-full rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => handleArtifactsSelection(folder.outputId, "autocomplete")}
                  >
                    {folder.outputId}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="upload" className="space-y-4">
          <div data-testid="artifacts-upload-plan">
            <FileDropZone
              accept=".json"
              label="Upload do plan.json"
              placeholder="Arraste ou clique para selecionar o plan.json"
              onFileContent={(content, filename) => {
                setPlanContent(content)
                setPlanFileName(filename)
              }}
              onError={(message) => onError?.(message)}
            />
          </div>
          <div data-testid="artifacts-upload-spec">
            <FileDropZone
              accept=".spec.tsx,.spec.ts"
              label="Upload do teste (.spec.tsx)"
              placeholder="Arraste ou clique para selecionar o teste"
              onFileContent={(content, filename) => {
                setSpecContent(content)
                setSpecFileName(filename)
              }}
              onError={(message) => onError?.(message)}
            />
          </div>
          {(planFileName || specFileName) && (
            <div className="text-xs text-muted-foreground">
              {planFileName ? `Plan: ${planFileName}` : ""}
              {planFileName && specFileName ? " • " : ""}
              {specFileName ? `Spec: ${specFileName}` : ""}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
