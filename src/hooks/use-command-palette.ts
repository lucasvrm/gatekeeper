import { useCallback, useEffect, useState } from "react"

type FocusEventLike = FocusEvent & { target: EventTarget | null }

type KeyboardEventLike = KeyboardEvent & { target: EventTarget | null }

export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  const openPalette = useCallback(() => {
    setOpen(true)
  }, [])

  const closePalette = useCallback(() => {
    setOpen(false)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEventLike) => {
      const key = event.key.toLowerCase()
      if (key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen(true)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  useEffect(() => {
    const handleFocusIn = (event: FocusEventLike) => {
      const target = event.target
      if (!(target instanceof HTMLInputElement)) return
      if (target.placeholder !== "Buscar...") return
      if (!target.closest("header")) return
      setOpen(true)
    }

    document.addEventListener("focusin", handleFocusIn)
    return () => {
      document.removeEventListener("focusin", handleFocusIn)
    }
  }, [])

  return { open, setOpen, openPalette, closePalette }
}
