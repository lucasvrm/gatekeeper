import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export interface DiffFile {
  filePath: string
  status: "modified" | "added" | "deleted"
  diff: string
  isBinary?: boolean
}

interface DiffViewerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  files: DiffFile[]
  initialFileIndex?: number
}

const getFileStatusLabel = (status: DiffFile["status"]) => {
  switch (status) {
    case "added":
      return "Arquivo novo"
    case "deleted":
      return "Arquivo removido"
    default:
      return "Modificado"
  }
}

const isBinaryDiff = (diff: string) => {
  return /binary files|git binary patch/i.test(diff)
}

export function DiffViewerModal({
  open,
  onOpenChange,
  files,
  initialFileIndex = 0,
}: DiffViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialFileIndex)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    setCurrentIndex(initialFileIndex)
  }, [open, initialFileIndex])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      containerRef.current?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  const hasFiles = files.length > 0
  const currentFile = files[currentIndex] ?? files[0]

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      onOpenChange(false)
      return
    }

    if (event.key === "ArrowLeft" && currentIndex > 0) {
      setCurrentIndex((index) => Math.max(0, index - 1))
      return
    }

    if (event.key === "ArrowRight" && currentIndex < files.length - 1) {
      setCurrentIndex((index) => Math.min(files.length - 1, index + 1))
    }
  }

  const renderDiffLines = (diff: string) => {
    return diff.split("\n").map((line, index) => {
      let className = ""
      if (line.startsWith("---") || line.startsWith("-")) {
        className = "line-removed"
      } else if (line.startsWith("+++") || line.startsWith("+")) {
        className = "line-added"
      }

      return (
        <div key={`${index}-${line}`} className={className}>
          {line}
        </div>
      )
    })
  }

  const binary = currentFile?.isBinary || isBinaryDiff(currentFile?.diff || "")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="diff-viewer-modal"
        className="sm:max-w-4xl"
        onKeyDown={handleKeyDown}
        tabIndex={0}
        ref={containerRef}
      >
        <DialogHeader>
          <DialogTitle>Diff do arquivo</DialogTitle>
          <DialogDescription className="sr-only">Modal para visualizar diffs de arquivos.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
          <div className="space-y-2" data-testid="diff-file-list">
            {files.map((file, index) => (
              <Button
                key={file.filePath}
                type="button"
                variant="ghost"
                data-testid={`diff-file-item-${index}`}
                onClick={() => setCurrentIndex(index)}
                aria-current={index === currentIndex}
                className={cn(
                  "w-full justify-start text-left whitespace-nowrap",
                  index === currentIndex && "bg-muted"
                )}
              >
                <span className="truncate">{file.filePath}</span>
                {(file.status === "added" || file.status === "deleted") && (
                  <span
                    data-testid={`diff-file-status-${index}`}
                    className="ml-2 text-xs text-muted-foreground"
                  >
                    {getFileStatusLabel(file.status)}
                  </span>
                )}
              </Button>
            ))}
          </div>

          <div data-testid="diff-content" className="bg-muted/30 rounded-md p-3">
            {!hasFiles ? (
              <div className="text-xs text-muted-foreground">Sem diff disponível</div>
            ) : binary ? (
              <div data-testid="diff-binary-message">Arquivo binário modificado</div>
            ) : (
              <pre className="text-xs font-mono whitespace-pre-wrap">
                {renderDiffLines(currentFile?.diff || "")}
              </pre>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <span data-testid="diff-nav-indicator" className="text-xs text-muted-foreground">
            {hasFiles ? `${currentIndex + 1} de ${files.length}` : "0 de 0"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              data-testid="diff-nav-prev"
              onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
              disabled={!hasFiles || currentIndex === 0}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              data-testid="diff-nav-next"
              onClick={() => setCurrentIndex((index) => Math.min(files.length - 1, index + 1))}
              disabled={!hasFiles || currentIndex === files.length - 1}
            >
              Próximo
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

