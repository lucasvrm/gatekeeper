import { useState, useRef, useCallback } from "react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Upload, FileJson, FileCode, X } from "lucide-react"

interface FileUploadDialogProps {
  open: boolean
  onClose: () => void
  runId: string
  onUploadSuccess?: () => void
}

interface FilePreview {
  file: File
  content: string
}

export function FileUploadDialog({
  open,
  onClose,
  runId,
  onUploadSuccess,
}: FileUploadDialogProps) {
  const [uploading, setUploading] = useState(false)
  const [planFile, setPlanFile] = useState<FilePreview | null>(null)
  const [specFile, setSpecFile] = useState<FilePreview | null>(null)
  const [dragOverPlan, setDragOverPlan] = useState(false)
  const [dragOverSpec, setDragOverSpec] = useState(false)

  const planInputRef = useRef<HTMLInputElement>(null)
  const specInputRef = useRef<HTMLInputElement>(null)

  const validatePlanFile = useCallback(async (file: File): Promise<string | null> => {
    if (!file.name.endsWith('.json')) {
      return 'File must be a JSON file'
    }

    if (file.size > 5 * 1024 * 1024) {
      return 'File size must be less than 5MB'
    }

    try {
      const content = await file.text()
      JSON.parse(content)
      return null
    } catch {
      return 'Invalid JSON format'
    }
  }, [])

  const validateSpecFile = useCallback(async (file: File): Promise<string | null> => {
    if (!file.name.endsWith('.spec.tsx') && !file.name.endsWith('.spec.ts')) {
      return 'File must be a .spec.tsx or .spec.ts file'
    }

    if (file.size > 5 * 1024 * 1024) {
      return 'File size must be less than 5MB'
    }

    return null
  }, [])

  const handlePlanFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverPlan(false)

    const file = e.dataTransfer.files[0]
    if (!file) return

    const error = await validatePlanFile(file)
    if (error) {
      toast.error(error)
      return
    }

    const content = await file.text()
    setPlanFile({ file, content })
  }, [validatePlanFile])

  const handleSpecFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverSpec(false)

    const file = e.dataTransfer.files[0]
    if (!file) return

    const error = await validateSpecFile(file)
    if (error) {
      toast.error(error)
      return
    }

    const content = await file.text()
    setSpecFile({ file, content })
  }, [validateSpecFile])

  const handlePlanFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const error = await validatePlanFile(file)
    if (error) {
      toast.error(error)
      return
    }

    const content = await file.text()
    setPlanFile({ file, content })
  }, [validatePlanFile])

  const handleSpecFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const error = await validateSpecFile(file)
    if (error) {
      toast.error(error)
      return
    }

    const content = await file.text()
    setSpecFile({ file, content })
  }, [validateSpecFile])

  const handleUpload = async () => {
    if (!planFile && !specFile) {
      toast.error("Please select at least one file to upload")
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()

      if (planFile) {
        formData.append('planJson', planFile.file)
      }

      if (specFile) {
        formData.append('specFile', specFile.file)
      }

      await api.runs.uploadFiles(runId, formData)

      toast.success("Files uploaded successfully. Run has been reset and queued for re-execution.")
      onUploadSuccess?.()
      handleClose()
    } catch (error) {
      console.error("Failed to upload files:", error)
      toast.error("Failed to upload files")
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    setPlanFile(null)
    setSpecFile(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? handleClose() : null)}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            Upload plan.json or spec file to replace existing files. The run will be reset and re-executed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Plan.json Upload */}
          <div>
            <Label className="mb-2 block">plan.json</Label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
                dragOverPlan ? 'border-primary bg-primary/5' : 'border-border'
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverPlan(true)
              }}
              onDragLeave={() => setDragOverPlan(false)}
              onDrop={handlePlanFileDrop}
            >
              {planFile ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileJson className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium">{planFile.file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(planFile.file.size / 1024).toFixed(2)} KB)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPlanFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="bg-muted rounded p-3 max-h-40 overflow-auto">
                    <pre className="text-xs">{planFile.content.slice(0, 500)}</pre>
                    {planFile.content.length > 500 && (
                      <span className="text-xs text-muted-foreground">...</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Drag and drop plan.json here, or click to browse
                  </p>
                  <input
                    ref={planInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handlePlanFileSelect}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => planInputRef.current?.click()}
                  >
                    Browse Files
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Spec File Upload */}
          <div>
            <Label className="mb-2 block">Spec File (.spec.tsx or .spec.ts)</Label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
                dragOverSpec ? 'border-primary bg-primary/5' : 'border-border'
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverSpec(true)
              }}
              onDragLeave={() => setDragOverSpec(false)}
              onDrop={handleSpecFileDrop}
            >
              {specFile ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileCode className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium">{specFile.file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(specFile.file.size / 1024).toFixed(2)} KB)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSpecFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="bg-muted rounded p-3 max-h-40 overflow-auto">
                    <pre className="text-xs">{specFile.content.slice(0, 500)}</pre>
                    {specFile.content.length > 500 && (
                      <span className="text-xs text-muted-foreground">...</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Drag and drop spec file here, or click to browse
                  </p>
                  <input
                    ref={specInputRef}
                    type="file"
                    accept=".ts,.tsx"
                    className="hidden"
                    onChange={handleSpecFileSelect}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => specInputRef.current?.click()}
                  >
                    Browse Files
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={uploading || (!planFile && !specFile)}
          >
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
