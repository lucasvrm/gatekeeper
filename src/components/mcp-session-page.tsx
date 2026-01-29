import { useState } from "react"
import { SessionConfigTab } from "@/components/mcp/session-config-tab"
import { StatusTab } from "@/components/mcp/status-tab"
import { SnippetsTab } from "@/components/mcp/snippets-tab"
import { ContextPacksTab } from "@/components/mcp/context-packs-tab"
import { PresetsTab } from "@/components/mcp/presets-tab"
import { HistoryTab } from "@/components/mcp/history-tab"
import { cn } from "@/lib/utils"

type TabType = "config" | "status" | "snippets" | "context" | "presets" | "history"

export function MCPSessionPage() {
  const [activeTab, setActiveTab] = useState<TabType>("config")

  return (
    <div data-testid="mcp-session-page" className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">MCP Session</h1>
        <p className="text-muted-foreground mt-1">
          Configure sua sessão MCP e visualize o status dos serviços.
        </p>
      </div>

      <div className="border-b border-border">
        <div role="tablist" className="flex gap-4">
          <button
            role="tab"
            aria-selected={activeTab === "config"}
            onClick={() => setActiveTab("config")}
            className={cn(
              "pb-2 px-1 text-sm font-medium transition-colors",
              activeTab === "config"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            data-testid="tab-config"
          >
            Config
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "status"}
            onClick={() => setActiveTab("status")}
            className={cn(
              "pb-2 px-1 text-sm font-medium transition-colors",
              activeTab === "status"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            data-testid="tab-status"
          >
            Status
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "snippets"}
            onClick={() => setActiveTab("snippets")}
            className={cn(
              "pb-2 px-1 text-sm font-medium transition-colors",
              activeTab === "snippets"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            data-testid="tab-snippets"
          >
            Snippets
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "context"}
            onClick={() => setActiveTab("context")}
            className={cn(
              "pb-2 px-1 text-sm font-medium transition-colors",
              activeTab === "context"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            data-testid="tab-context"
          >
            Context
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "presets"}
            onClick={() => setActiveTab("presets")}
            className={cn(
              "pb-2 px-1 text-sm font-medium transition-colors",
              activeTab === "presets"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            data-testid="tab-presets"
          >
            Presets
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            className={cn(
              "pb-2 px-1 text-sm font-medium transition-colors",
              activeTab === "history"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            data-testid="tab-history"
          >
            History
          </button>
        </div>
      </div>

      <div role="tabpanel" className="mt-6">
        {activeTab === "config" && <SessionConfigTab />}
        {activeTab === "status" && <StatusTab />}
        {activeTab === "snippets" && <SnippetsTab />}
        {activeTab === "context" && <ContextPacksTab />}
        {activeTab === "presets" && <PresetsTab />}
        {activeTab === "history" && <HistoryTab />}
      </div>
    </div>
  )
}
