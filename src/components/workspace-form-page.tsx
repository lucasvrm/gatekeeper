import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft } from "@phosphor-icons/react"
import { toast } from "sonner"

export function WorkspaceFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    rootPath: "",
    artifactsDir: "artifacts",
    isActive: true,
  })

  useEffect(() => {
    if (!id) return

    const loadWorkspace = async () => {
      setLoading(true)
      try {
        const data = await api.workspaces.get(id)
        setFormData({
          name: data.name,
          description: data.description || "",
          rootPath: data.rootPath,
          artifactsDir: data.artifactsDir,
          isActive: data.isActive,
        })
      } catch (error) {
        console.error("Failed to load workspace:", error)
        toast.error("Falha ao carregar workspace")
        navigate("/workspaces")
      } finally {
        setLoading(false)
      }
    }

    loadWorkspace()
  }, [id, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      if (isEdit && id) {
        await api.workspaces.update(id, formData)
        toast.success("Workspace atualizado com sucesso")
      } else {
        await api.workspaces.create(formData)
        toast.success("Workspace criado com sucesso")
      }
      navigate("/workspaces")
    } catch (error) {
      console.error("Failed to save workspace:", error)
      toast.error(
        isEdit
          ? "Falha ao atualizar workspace"
          : "Falha ao criar workspace"
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/workspaces")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">
          {isEdit ? "Editar Workspace" : "Novo Workspace"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isEdit
            ? "Atualizar configurações do workspace"
            : "Criar um novo workspace para organizar projetos"}
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="ex: Gatekeeper"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Descrição opcional do workspace"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rootPath">
              Root Path <span className="text-destructive">*</span>
            </Label>
            <Input
              id="rootPath"
              value={formData.rootPath}
              onChange={(e) =>
                setFormData({ ...formData, rootPath: e.target.value })
              }
              placeholder="ex: C:\Projects\MyApp"
              required
            />
            <p className="text-xs text-muted-foreground">
              Caminho raiz do workspace no sistema de arquivos
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="artifactsDir">
              Artifacts Directory <span className="text-destructive">*</span>
            </Label>
            <Input
              id="artifactsDir"
              value={formData.artifactsDir}
              onChange={(e) =>
                setFormData({ ...formData, artifactsDir: e.target.value })
              }
              placeholder="artifacts"
              required
            />
            <p className="text-xs text-muted-foreground">
              Diretório relativo ao root path onde os artifacts serão salvos. Se vazio, usa valor padrão do sistema.
            </p>
          </div>

          {isEdit && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">Ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Workspaces inativos não aparecem nas listagens por padrão
                </p>
              </div>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Salvando..." : isEdit ? "Atualizar" : "Criar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/workspaces")}
              disabled={submitting}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
