/**
 * usePageShell — lets any routed page:
 *   1. Set the AppShell `page` key (for contract overrides)  → via lightweight context
 *   2. Inject ReactNodes into the AppShell header               → via React portals
 *
 * Portals avoid the "ReactNode in state" trap that causes infinite re-renders.
 * The header DOM targets (`#orqui-header-left`, `#orqui-header-right`) are
 * rendered by AppShell in runtime.tsx with `display: contents` so they're
 * invisible layout-wise.
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"

// ── Page key context (string only — cheap, stable) ──────────────────────────

interface PageKeyContextValue {
  pageKey: string | undefined
  setPageKey: (key: string | undefined) => void
}

const PageKeyContext = createContext<PageKeyContextValue>({
  pageKey: undefined,
  setPageKey: () => {},
})

export function PageShellProvider({ children }: { children: ReactNode }) {
  const [pageKey, setPageKeyState] = useState<string | undefined>(undefined)

  const setPageKey = useCallback((key: string | undefined) => {
    setPageKeyState((prev) => (prev === key ? prev : key))
  }, [])

  return (
    <PageKeyContext.Provider value={{ pageKey, setPageKey }}>
      {children}
    </PageKeyContext.Provider>
  )
}

/** Read current page key (used by App.tsx → AppShell page prop) */
export function usePageShellState() {
  return useContext(PageKeyContext)
}

// ── Portal-based header injection ───────────────────────────────────────────

interface PageShellConfig {
  page?: string
  headerLeft?: ReactNode
  headerRight?: ReactNode
}

/**
 * Call from any page component to set the page key and portal header content.
 *
 * ```tsx
 * const portals = usePageShell({ page: "runs", headerLeft: <Back/>, headerRight: <Actions/> })
 * return <>{portals}<div>…page content…</div></>
 * ```
 *
 * The returned `portals` fragment contains the createPortal calls and MUST be
 * included in the component's JSX for React to render them.
 */
export function usePageShell(config: PageShellConfig): ReactNode {
  const { setPageKey } = useContext(PageKeyContext)

  // Set page key on mount, clear on unmount
  useEffect(() => {
    setPageKey(config.page)
    return () => setPageKey(undefined)
     
  }, [config.page, setPageKey])

  // Find portal targets (they exist after AppShell mounts)
  const leftTarget = typeof document !== "undefined" ? document.getElementById("orqui-header-left") : null
  const rightTarget = typeof document !== "undefined" ? document.getElementById("orqui-header-right") : null

  return (
    <>
      {config.headerLeft && leftTarget && createPortal(config.headerLeft, leftTarget)}
      {config.headerRight && rightTarget && createPortal(config.headerRight, rightTarget)}
    </>
  )
}
