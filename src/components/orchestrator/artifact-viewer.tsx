import { useState } from "react"
import { toast } from "sonner"
import type { ParsedArtifact } from "./types"

interface ArtifactViewerProps {
  artifacts: ParsedArtifact[]
}

export function ArtifactViewer({ artifacts }: ArtifactViewerProps) {
  const [selected, setSelected] = useState(0)

  // Garantir que artifacts seja sempre um array válido
  if (!Array.isArray(artifacts) || artifacts.length === 0) return null

  const content = artifacts[selected]?.content ?? ""
  const lines = content.split("\n")

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      toast.success("Artifact copied to clipboard")
    } catch (err) {
      toast.error("Failed to copy: " + (err as Error).message)
    }
  }

  const handleSave = () => {
    try {
      const blob = new Blob([content], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = artifacts[selected].filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Artifact saved")
    } catch (err) {
      toast.error("Failed to save: " + (err as Error).message)
    }
  }

  const handleSaveAll = async () => {
    try {
      const JSZip = (await import("jszip")).default
      const zip = new JSZip()
      artifacts.forEach((a) => zip.file(a.filename, a.content))
      const blob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "artifacts.zip"
      a.click()
      URL.revokeObjectURL(url)
      toast.success("All artifacts saved as ZIP")
    } catch (err) {
      toast.error("Failed to save all: " + (err as Error).message)
    }
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden" data-testid="artifact-viewer">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-2 py-1">
        <div className="flex">
          {artifacts.map((a, i) => (
            <button
              key={a.filename}
              onClick={() => setSelected(i)}
              className={`px-3 py-2 text-xs font-mono transition-colors ${
                i === selected
                  ? "bg-card text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`artifact-tab-${i}`}
            >
              {a.filename}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button
            onClick={handleCopy}
            title="Copy to clipboard"
            data-testid="artifact-copy-btn"
            className="h-7 px-2"
          >
            📋
          </button>
          <button
            onClick={handleSave}
            title="Save current artifact"
            data-testid="artifact-save-btn"
            className="h-7 px-2"
          >
            💾
          </button>
          <button
            onClick={handleSaveAll}
            title="Save all as ZIP"
            data-testid="artifact-save-all-btn"
            className="h-7 px-2"
          >
            📦
          </button>
        </div>
      </div>
      <div className="overflow-auto max-h-96 bg-card" data-testid="artifact-content">
        <table className="w-full" style={{ borderCollapse: 'collapse', borderSpacing: 0 }}>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} style={{ border: 'none' }}>
                <td className="select-none text-right pr-2 pl-2 py-0 text-[10px] font-mono text-muted-foreground/25 w-[1%] whitespace-nowrap align-top leading-[1.35rem]" style={{ border: 'none' }}>
                  {i + 1}
                </td>
                <td className="pl-3 pr-4 py-0 text-xs font-mono whitespace-pre text-foreground align-top leading-[1.35rem]" style={{ border: 'none' }}>
                  {line || "\u00A0"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
