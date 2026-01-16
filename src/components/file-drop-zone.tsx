import { useCallback, useEffect, useRef, useState } from "react"
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react"
import { UploadSimple } from "@phosphor-icons/react"

export interface FileDropZoneProps {
  accept: string
  onFileContent: (content: string, filename: string) => void
  onError: (error: string) => void
  label: string
  placeholder: string
}

const parseAcceptList = (accept: string) => {
  return accept
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => (value.startsWith(".") ? value.toLowerCase() : `.${value.toLowerCase()}`))
}

const isAllowedExtension = (fileName: string, accept: string) => {
  const extensions = parseAcceptList(accept)
  if (extensions.length === 0) return true
  const lowerName = fileName.toLowerCase()
  return extensions.some((ext) => lowerName.endsWith(ext))
}

export function FileDropZone({
  accept,
  onFileContent,
  onError,
  label,
  placeholder,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [status, setStatus] = useState<"idle" | "loaded" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const resetError = useCallback(() => {
    setStatus((currentStatus) => {
      if (currentStatus === "error") {
        setErrorMessage(null)
        return "idle"
      }
      return currentStatus
    })
  }, [])

  const reportError = useCallback((message: string) => {
    setStatus("error")
    setErrorMessage(message)
    onError(message)
  }, [onError])

  const processContent = useCallback((content: string, name: string) => {
    if (!isAllowedExtension(name, accept)) {
      reportError(`File extension not allowed: ${name}`)
      return
    }

    setFileName(name)
    setStatus("loaded")
    setErrorMessage(null)
    onFileContent(content, name)
  }, [accept, onFileContent, reportError])

  const handleFile = useCallback((file: File) => {
    if (!isAllowedExtension(file.name, accept)) {
      reportError(`File extension not allowed: ${file.name}`)
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : ""
      processContent(content, file.name)
    }
    reader.onerror = () => {
      reportError("Failed to read file")
    }
    reader.readAsText(file)
  }, [accept, processContent, reportError])

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    resetError()

    const file = event.dataTransfer.files?.[0]
    if (!file) {
      reportError("No file detected")
      return
    }

    handleFile(file)
  }

  const handlePicker = () => {
    resetError()
    inputRef.current?.click()
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    resetError()
    const file = event.target.files?.[0]
    if (!file) return
    handleFile(file)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      handlePicker()
    }
  }

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const handlePaste = (event: ClipboardEvent) => {
      const clipboard = event.clipboardData
      if (!clipboard) return

      const file = clipboard.files?.[0]
      if (file) {
        event.preventDefault()
        resetError()
        handleFile(file)
        return
      }

      const text = clipboard.getData("text")
      if (!text) return

      const extensions = parseAcceptList(accept)
      const fallbackExtension = extensions[0]
      if (!fallbackExtension) {
        reportError("No acceptable extension configured for paste")
        return
      }

      event.preventDefault()
      resetError()
      processContent(text, `pasted${fallbackExtension}`)
    }

    element.addEventListener("paste", handlePaste)
    return () => {
      element.removeEventListener("paste", handlePaste)
    }
  }, [accept, handleFile, processContent, reportError, resetError])

  const borderClass = isDragging
    ? "border-primary bg-primary/5"
    : status === "loaded"
      ? "border-emerald-500/60 bg-emerald-500/5"
      : status === "error"
        ? "border-destructive bg-destructive/5"
        : "border-border"

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        role="button"
        tabIndex={0}
        aria-label={label}
        onKeyDown={handleKeyDown}
        onClick={handlePicker}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition ${borderClass}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleInputChange}
        />
        <div className="flex flex-col items-center gap-2 text-sm">
          <UploadSimple className="h-6 w-6 text-muted-foreground" />
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{placeholder}</div>
          {fileName && (
            <div className="text-xs text-emerald-600">{fileName}</div>
          )}
        </div>
      </div>
      {status === "error" && (
        <div className="text-xs text-destructive" aria-live="polite">
          {errorMessage ?? "Upload failed. Click to try again."}
        </div>
      )}
    </div>
  )
}
