import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import type { ManifestFile } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Plus, Trash } from "@phosphor-icons/react"
import { toast } from "sonner"

export function NewValidationPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    projectPath: "",
    taskPrompt: "",
    baseRef: "HEAD~1",
    targetRef: "HEAD",
    testFilePath: "",
    dangerMode: false,
  })
  const [useManifest, setUseManifest] = useState(false)
  const [manifestFiles, setManifestFiles] = useState<ManifestFile[]>([])
  const [manifestTestFile, setManifestTestFile] = useState("")

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.projectPath.trim()) {
      newErrors.projectPath = "Project path is required"
    }

    if (!formData.taskPrompt.trim() || formData.taskPrompt.length < 10) {
      newErrors.taskPrompt = "Task prompt must be at least 10 characters"
    }

    if (useManifest && manifestFiles.length > 0 && !manifestTestFile.trim()) {
      newErrors.manifestTestFile = "Test file is required when manifest has entries"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      toast.error("Please fix form errors")
      return
    }

    setLoading(true)
    try {
      const requestData: any = {
        projectPath: formData.projectPath,
        taskPrompt: formData.taskPrompt,
        baseRef: formData.baseRef,
        targetRef: formData.targetRef,
        dangerMode: formData.dangerMode,
      }

      if (formData.testFilePath) {
        requestData.testFilePath = formData.testFilePath
      }

      if (useManifest && manifestFiles.length > 0) {
        requestData.manifest = {
          files: manifestFiles,
          testFile: manifestTestFile,
        }
      }

      const response = await api.runs.create(requestData)
      toast.success("Validation run created successfully")
      navigate(`/runs/${response.runId}`)
    } catch (error) {
      console.error("Failed to create run:", error)
      toast.error("Failed to create validation run")
    } finally {
      setLoading(false)
    }
  }

  const addManifestFile = () => {
    setManifestFiles([
      ...manifestFiles,
      { path: "", action: "CREATE", reason: "" },
    ])
  }

  const removeManifestFile = (index: number) => {
    setManifestFiles(manifestFiles.filter((_, i) => i !== index))
  }

  const updateManifestFile = (
    index: number,
    field: keyof ManifestFile,
    value: string
  ) => {
    const updated = [...manifestFiles]
    updated[index] = { ...updated[index], [field]: value }
    setManifestFiles(updated)
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/runs")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Runs
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">New Validation Run</h1>
        <p className="text-muted-foreground mt-1">
          Create a new validation run for your project
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 bg-card border-border">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="projectPath" className="text-sm font-medium uppercase tracking-wider">
                Project Path *
              </Label>
              <Input
                id="projectPath"
                value={formData.projectPath}
                onChange={(e) =>
                  setFormData({ ...formData, projectPath: e.target.value })
                }
                className={errors.projectPath ? "border-destructive" : ""}
                placeholder="/path/to/project"
              />
              {errors.projectPath && (
                <p className="text-xs text-destructive mt-1">{errors.projectPath}</p>
              )}
            </div>

            <div>
              <Label htmlFor="taskPrompt" className="text-sm font-medium uppercase tracking-wider">
                Task Prompt *
              </Label>
              <Textarea
                id="taskPrompt"
                value={formData.taskPrompt}
                onChange={(e) =>
                  setFormData({ ...formData, taskPrompt: e.target.value })
                }
                className={errors.taskPrompt ? "border-destructive" : ""}
                placeholder="Describe the task or changes to validate..."
                rows={6}
              />
              {errors.taskPrompt && (
                <p className="text-xs text-destructive mt-1">{errors.taskPrompt}</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card border-border">
          <h2 className="text-xl font-semibold mb-4">Git References</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="baseRef" className="text-sm font-medium uppercase tracking-wider">
                Base Ref
              </Label>
              <Input
                id="baseRef"
                value={formData.baseRef}
                onChange={(e) =>
                  setFormData({ ...formData, baseRef: e.target.value })
                }
                placeholder="HEAD~1"
              />
            </div>

            <div>
              <Label htmlFor="targetRef" className="text-sm font-medium uppercase tracking-wider">
                Target Ref
              </Label>
              <Input
                id="targetRef"
                value={formData.targetRef}
                onChange={(e) =>
                  setFormData({ ...formData, targetRef: e.target.value })
                }
                placeholder="HEAD"
              />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card border-border">
          <h2 className="text-xl font-semibold mb-4">Optional Settings</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="testFilePath" className="text-sm font-medium uppercase tracking-wider">
                Test File Path
              </Label>
              <Input
                id="testFilePath"
                value={formData.testFilePath}
                onChange={(e) =>
                  setFormData({ ...formData, testFilePath: e.target.value })
                }
                placeholder="/path/to/test/file"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="dangerMode"
                checked={formData.dangerMode}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, dangerMode: checked as boolean })
                }
              />
              <Label
                htmlFor="dangerMode"
                className="text-sm font-medium cursor-pointer"
              >
                Enable Danger Mode
              </Label>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Manifest (Optional)</h2>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="useManifest"
                checked={useManifest}
                onCheckedChange={(checked) => setUseManifest(checked as boolean)}
              />
              <Label htmlFor="useManifest" className="text-sm cursor-pointer">
                Include manifest
              </Label>
            </div>
          </div>

          {useManifest && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="manifestTestFile" className="text-sm font-medium uppercase tracking-wider">
                  Manifest Test File {manifestFiles.length > 0 && "*"}
                </Label>
                <Input
                  id="manifestTestFile"
                  value={manifestTestFile}
                  onChange={(e) => setManifestTestFile(e.target.value)}
                  className={errors.manifestTestFile ? "border-destructive" : ""}
                  placeholder="/path/to/test/file"
                />
                {errors.manifestTestFile && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.manifestTestFile}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium uppercase tracking-wider">
                    File Entries
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addManifestFile}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add File
                  </Button>
                </div>

                {manifestFiles.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No files added yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {manifestFiles.map((file, index) => (
                      <div
                        key={index}
                        className="p-4 border border-border rounded-lg space-y-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 space-y-3">
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                File Path
                              </Label>
                              <Input
                                value={file.path}
                                onChange={(e) =>
                                  updateManifestFile(index, "path", e.target.value)
                                }
                                placeholder="/path/to/file"
                                className="mt-1"
                              />
                            </div>

                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Action
                              </Label>
                              <Select
                                value={file.action}
                                onValueChange={(value) =>
                                  updateManifestFile(
                                    index,
                                    "action",
                                    value as "CREATE" | "MODIFY" | "DELETE"
                                  )
                                }
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="CREATE">Create</SelectItem>
                                  <SelectItem value="MODIFY">Modify</SelectItem>
                                  <SelectItem value="DELETE">Delete</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Reason (Optional)
                              </Label>
                              <Input
                                value={file.reason || ""}
                                onChange={(e) =>
                                  updateManifestFile(index, "reason", e.target.value)
                                }
                                placeholder="Why this change was made..."
                                className="mt-1"
                              />
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeManifestFile(index)}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/runs")}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-primary hover:bg-primary/90"
          >
            {loading ? "Creating..." : "Create Validation Run"}
          </Button>
        </div>
      </form>
    </div>
  )
}
