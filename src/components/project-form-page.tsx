import { useEffect, useState } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import { api } from "@/lib/api"
import type { Workspace } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft } from "@phosphor-icons/react"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function ProjectFormPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])

  const workspaceIdFromUrl = searchParams.get("workspaceId")

  const [formData, setFormData] = useState({
    workspaceId: workspaceIdFromUrl || "",
    name: "",
    description: "",
    baseRef: "origin/main",
    targetRef: "HEAD",
    backendWorkspace: "",
    isActive: true,
  })

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const workspacesData = await api.workspaces.list(1, 100)
        setWorkspaces(workspacesData.data)

        if (id) {
          const projectData = await api.projects.get(id)
          setFormData({
            workspaceId: projectData.workspaceId,
            name: projectData.name,
            description: projectData.description || "",
            baseRef: projectData.baseRef,
            targetRef: projectData.targetRef,
            backendWorkspace: projectData.backendWorkspace || "",
            isActive: projectData.isActive,
          })
        }
      } catch (error) {
        console.error("Failed to load data:", error)
        toast.error("Falha ao carregar dados")
        if (isEdit) {
          navigate("/workspaces")
        }
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [id, isEdit, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.workspaceId) {
      toast.error("Selecione um workspace")
      return
    }

    setSubmitting(true)

    try {
      if (isEdit && id) {
        await api.projects.update(id, formData)
        toast.success("Projeto atualizado com sucesso")
        navigate(`/workspaces/${formData.workspaceId}`)
      } else {
        await api.projects.create(formData)
        toast.success("Projeto criado com sucesso")
        navigate(`/workspaces/${formData.workspaceId}`)
      }
    } catch (error) {
      console.error("Failed to save project:", error)
      toast.error(
        isEdit ? "Falha ao atualizar projeto" : "Falha ao criar projeto"
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (formData.workspaceId) {
      navigate(`/workspaces/${formData.workspaceId}`)
    } else {
      navigate("/workspaces")
    }
  }

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={handleCancel}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">
          {isEdit ? "Editar Projeto" : "Novo Projeto"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isEdit
            ? "Atualizar configurações do projeto"
            : "Criar um novo projeto no workspace"}
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="workspaceId">
              Workspace <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.workspaceId}
              onValueChange={(value) =>
                setFormData({ ...formData, workspaceId: value })
              }
              disabled={isEdit}
            >
              <SelectTrigger id="workspaceId">
                <SelectValue placeholder="Selecione um workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEdit && (
              <p className="text-xs text-muted-foreground">
                O workspace não pode ser alterado após a criação
              </p>
            )}
          </div>

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
              placeholder="ex: gatekeeper"
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
              placeholder="Descrição opcional do projeto"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="baseRef">
                Base Ref <span className="text-destructive">*</span>
              </Label>
              <Input
                id="baseRef"
                value={formData.baseRef}
                onChange={(e) =>
                  setFormData({ ...formData, baseRef: e.target.value })
                }
                placeholder="origin/main"
                required
              />
              <p className="text-xs text-muted-foreground">
                Branch base para comparação. Se vazio, usa valor padrão do sistema.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetRef">
                Target Ref <span className="text-destructive">*</span>
              </Label>
              <Input
                id="targetRef"
                value={formData.targetRef}
                onChange={(e) =>
                  setFormData({ ...formData, targetRef: e.target.value })
                }
                placeholder="HEAD"
                required
              />
              <p className="text-xs text-muted-foreground">
                Branch ou commit alvo. Se vazio, usa valor padrão do sistema.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="backendWorkspace">Backend Workspace</Label>
            <Input
              id="backendWorkspace"
              value={formData.backendWorkspace}
              onChange={(e) =>
                setFormData({ ...formData, backendWorkspace: e.target.value })
              }
              placeholder="ex: packages/gatekeeper-api"
            />
            <p className="text-xs text-muted-foreground">
              Caminho relativo ao root path do workspace para o backend. Se vazio, usa valor padrão do sistema.
            </p>
          </div>

          {isEdit && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">Ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Projetos inativos não aceitam novos runs
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
              onClick={handleCancel}
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
