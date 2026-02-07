import { useEffect, useState } from "react"

/**
 * Hook que retorna um valor debounced após um delay especificado.
 * Útil para otimizar buscas e prevenir requests excessivas.
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
