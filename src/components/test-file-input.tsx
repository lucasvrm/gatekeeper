import { useEffect, useRef, useState } from "react"
import { FileDropZone } from "./file-drop-zone"

export interface TestFileInputProps {
  onFilePath: (path: string) => void
  onPathManual: (path: string) => void
  onError: (error: string) => void
}

const allowedTestExtensions = [
  ".spec.ts",
  ".spec.tsx",
  ".test.ts",
  ".test.tsx",
  ".spec.js",
  ".spec.jsx",
  ".test.js",
  ".test.jsx",
]

const acceptList = allowedTestExtensions.join(",")

const isAllowedTestPath = (path: string) => {
  const lowerPath = path.toLowerCase()
  return allowedTestExtensions.some((ext) => lowerPath.endsWith(ext))
}

export function TestFileInput({
  onFilePath,
  onPathManual,
  onError,
}: TestFileInputProps) {
  const [mode, setMode] = useState<"upload" | "manual">("upload")
  const [manualPath, setManualPath] = useState("")
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const debounceRef = useRef<number | null>(null)

  const switchMode = (nextMode: "upload" | "manual") => {
    if (nextMode === mode) return
    setMode(nextMode)
    setManualPath("")
    setUploadedFileName(null)
    setErrorMessage(null)
    onPathManual("")
  }

  const handleDropZoneContent = (_content: string, filename: string) => {
    setUploadedFileName(filename)
    setErrorMessage(null)
    onFilePath(filename)
  }

  const handleDropZoneError = (message: string) => {
    setErrorMessage(message)
    onError(message)
  }

  useEffect(() => {
    if (mode !== "manual") return

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
    }

    debounceRef.current = window.setTimeout(() => {
      const trimmed = manualPath.trim()
      if (!trimmed) {
        setErrorMessage(null)
        onPathManual("")
        return
      }

      if (!isAllowedTestPath(trimmed)) {
        const message = "Invalid test file extension"
        setErrorMessage(message)
        onError(message)
        return
      }

      setErrorMessage(null)
      onPathManual(trimmed)
    }, 300)

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
      }
    }
  }, [manualPath, mode, onError, onPathManual])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-1 text-sm">
        <button
          type="button"
          onClick={() => switchMode("upload")}
          className={`flex-1 rounded-md px-3 py-2 transition ${
            mode === "upload" ? "bg-background shadow" : "text-muted-foreground"
          }`}
        >
          Upload
        </button>
        <button
          type="button"
          onClick={() => switchMode("manual")}
          className={`flex-1 rounded-md px-3 py-2 transition ${
            mode === "manual" ? "bg-background shadow" : "text-muted-foreground"
          }`}
        >
          Path Manual
        </button>
      </div>

      {mode === "upload" ? (
        <div className="space-y-2">
          <FileDropZone
            accept={acceptList}
            label="Upload test file"
            placeholder="Drag & drop or click to select a test file"
            onFileContent={handleDropZoneContent}
            onError={handleDropZoneError}
          />
          {uploadedFileName && (
            <div className="text-xs text-emerald-600">{uploadedFileName}</div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            value={manualPath}
            onChange={(event) => setManualPath(event.target.value)}
            placeholder="src/components/Button.spec.tsx"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      )}

      {errorMessage && (
        <div className="text-xs text-destructive" aria-live="polite">
          {errorMessage}
        </div>
      )}
    </div>
  )
}
