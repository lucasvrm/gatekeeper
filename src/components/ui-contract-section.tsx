import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Upload, Trash } from "@phosphor-icons/react"
import { UIContractUploadDialog } from "./ui-contract-upload-dialog"
import { api } from "@/lib/api"
import type { UIContract } from "@/lib/types"
import { toast } from "sonner"

interface UIContractSectionProps {
  projectId: string
  uiContract: UIContract | null
  onUpdate: () => void
}

export function UIContractSection({ projectId, uiContract, onUpdate }: UIContractSectionProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const handleDelete = async () => {
    setDeleting(true)

    try {
      await api.uiContract.delete(projectId)
      toast.success("UI Contract removido com sucesso")
      setDeleteDialogOpen(false)
      onUpdate()
    } catch (error) {
      console.error("Failed to delete UI contract:", error)
      toast.error(error instanceof Error ? error.message : "Falha ao deletar contrato")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div data-testid="ui-contract-section" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">UI Contract</h2>
          {!uiContract && (
            <Button
              data-testid="ui-contract-upload-btn"
              onClick={() => setUploadDialogOpen(true)}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Contract
            </Button>
          )}
        </div>

        <Card className="p-6">
          {!uiContract ? (
            <div data-testid="ui-contract-empty" className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Nenhum UI Contract configurado para este projeto
              </p>
              <p className="text-sm text-muted-foreground">
                Faça upload de um contrato exportado do Figma ou outra ferramenta de design
              </p>
            </div>
          ) : (
            <div data-testid="ui-contract-loaded" className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">UI Contract</Badge>
                    <Badge variant="secondary">Ativo</Badge>
                  </div>

                  <dl className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Versão</dt>
                      <dd
                        data-testid="ui-contract-version"
                        className="mt-1 font-mono text-sm"
                      >
                        {uiContract.version}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Hash</dt>
                      <dd
                        data-testid="ui-contract-hash"
                        className="mt-1 font-mono text-sm"
                      >
                        {uiContract.hash.substring(0, 12)}...
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">
                        Upload em
                      </dt>
                      <dd
                        data-testid="ui-contract-date"
                        className="mt-1 text-sm"
                      >
                        {formatDate(uiContract.uploadedAt)}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="ui-contract-reupload-btn"
                    onClick={() => setUploadDialogOpen(true)}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Reupload
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    data-testid="ui-contract-delete-btn"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash className="w-4 h-4 mr-2" />
                    Deletar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <UIContractUploadDialog
        projectId={projectId}
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={onUpdate}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar deleção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o UI Contract deste projeto? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deletando..." : "Deletar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
