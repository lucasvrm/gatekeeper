import { useMemo, useState } from "react"
import type { LLMPlanOutput } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CaretDown, CaretRight, FileText } from "@phosphor-icons/react"

export interface JsonPreviewProps {
  data: LLMPlanOutput | null
}

const renderValue = (value: string | number | boolean) => {
  if (typeof value === "boolean") return value ? "true" : "false"
  return String(value)
}

const actionStyles: Record<string, string> = {
  CREATE: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  MODIFY: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  DELETE: "bg-rose-500/10 text-rose-700 border-rose-500/30",
}

export function JsonPreview({ data }: JsonPreviewProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [showFullPrompt, setShowFullPrompt] = useState(false)

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const manifestFiles = useMemo(() => data?.manifest?.files ?? [], [data])
  const shouldCollapseFiles = manifestFiles.length > 6
  const isFilesCollapsed = collapsedSections.has("manifest.files")
  const filesToShow = useMemo(() => {
    if (!shouldCollapseFiles) return manifestFiles
    return isFilesCollapsed ? manifestFiles.slice(0, 3) : manifestFiles
  }, [manifestFiles, isFilesCollapsed, shouldCollapseFiles])

  if (!data) {
    return (
      <Card className="p-6 border-border bg-card">
        <div className="flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
          <FileText className="h-6 w-6" />
          <p className="text-sm">Faca upload do JSON para visualizar</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 border-border bg-card space-y-5">
      <div className="space-y-3">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Identificacao
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Output ID</div>
            <div className="text-sm font-medium">{data.outputId}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Base Ref</div>
            <div className="text-sm font-medium">{data.baseRef}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Target Ref</div>
            <div className="text-sm font-medium">{data.targetRef}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Danger Mode</div>
            <div className="text-sm font-medium">{renderValue(data.dangerMode)}</div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Task</div>
        <div className="text-sm leading-relaxed text-foreground">
          {showFullPrompt || data.taskPrompt.length <= 180
            ? data.taskPrompt
            : `${data.taskPrompt.slice(0, 180)}...`}
        </div>
        {data.taskPrompt.length > 180 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-0 text-xs text-primary"
            onClick={() => setShowFullPrompt((prev) => !prev)}
          >
            {showFullPrompt ? "Ver menos" : "Ver mais"}
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Manifest
        </div>
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Manifest Test File</div>
          <div className="text-sm font-medium">{data.manifest.testFile}</div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Manifest Files</div>
            {shouldCollapseFiles && (
              <button
                type="button"
                onClick={() => toggleSection("manifest.files")}
                className="flex items-center gap-1 text-xs text-primary"
              >
                {isFilesCollapsed ? (
                  <>
                    <CaretRight className="h-3 w-3" /> Ver mais
                  </>
                ) : (
                  <>
                    <CaretDown className="h-3 w-3" /> Ver menos
                  </>
                )}
              </button>
            )}
          </div>

          <div className="space-y-2">
            {filesToShow.map((file, index) => (
              <div
                key={`${file.path}-${index}`}
                className="rounded-md border border-border bg-muted/40 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{file.path}</span>
                  <Badge
                    variant="outline"
                    className={actionStyles[file.action] ?? "border-border"}
                  >
                    {file.action}
                  </Badge>
                </div>
                {file.reason && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {file.reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
