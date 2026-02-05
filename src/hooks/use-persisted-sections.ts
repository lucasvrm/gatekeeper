import { useState, useEffect, useCallback } from "react"

const STORAGE_KEY = "gk-config-sections"

type SectionsState = Record<string, Record<string, boolean>>

function loadFromStorage(): SectionsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveToStorage(state: SectionsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage full or unavailable
  }
}

/**
 * Hook para persistir estado de seções colapsáveis em localStorage.
 *
 * @param tabKey - Identificador único da tab (ex: "advanced", "validators")
 * @param defaultState - Estado inicial das seções
 * @returns [openSections, toggleSection]
 */
export function usePersistedSections(
  tabKey: string,
  defaultState: Record<string, boolean>
): [Record<string, boolean>, (key: string) => void] {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const stored = loadFromStorage()
    return stored[tabKey] ?? defaultState
  })

  // Salvar no localStorage quando mudar
  useEffect(() => {
    const stored = loadFromStorage()
    stored[tabKey] = openSections
    saveToStorage(stored)
  }, [tabKey, openSections])

  const toggleSection = useCallback((key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  return [openSections, toggleSection]
}
