import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { Upload } from "@phosphor-icons/react"

interface UIContractUploadDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function UIContractUploadDialog({
  projectId,
  open,
  onOpenChange,
  onSuccess,
}: UIContractUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (file.type === "application/json" || file.name.endsWith(".json")) {
        setSelectedFile(file)
      } else {
        toast.error("Apenas arquivos JSON são permitidos")
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.type === "application/json" || file.name.endsWith(".json")) {
        setSelectedFile(file)
      } else {
        toast.error("Apenas arquivos JSON são permitidos")
      }
    }
  }

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast.error("Selecione um arquivo")
      return
    }

    setUploading(true)

    try {
      const text = await selectedFile.text()
      const contractData = JSON.parse(text)

      await api.uiContract.upload(projectId, contractData)

      toast.success("UI Contract uploaded com sucesso")
      setSelectedFile(null)
      onOpenChange(false) // close dialog
      onSuccess()
    } catch (error) {
      console.error("Failed to upload UI contract:", error)
      toast.error(error instanceof Error ? error.message : "Falha ao fazer upload do contrato")
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="ui-contract-upload-dialog">
        <DialogHeader>
          <DialogTitle>Upload UI Contract</DialogTitle>
          <DialogDescription>
            Faça upload de um arquivo JSON contendo o contrato de UI exportado do design.
          </DialogDescription>
        </DialogHeader>

        <div
          data-testid="ui-contract-dropzone"
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors
            ${dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
            ${selectedFile ? "bg-muted/50" : ""}
          `}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />

          {selectedFile ? (
            <div data-testid="ui-contract-file-preview" className="space-y-2">
              <Upload className="w-8 h-8 mx-auto text-primary" />
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Arraste um arquivo JSON ou clique para selecionar
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancelar
          </Button>
          <Button
            data-testid="ui-contract-submit-btn"
            onClick={handleSubmit}
            disabled={!selectedFile || uploading}
          >
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
