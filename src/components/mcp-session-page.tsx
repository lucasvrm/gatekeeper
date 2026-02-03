import { useState } from "react"
import { SessionConfigTab } from "@/components/mcp/session-config-tab"
import { StatusTab } from "@/components/mcp/status-tab"
import { PromptsTab } from "@/components/mcp/prompts-tab"
import { HistoryTab } from "@/components/mcp/history-tab"
import { cn } from "@/lib/utils"

type TabType = "config" | "prompts" | "status" | "history"

export function MCPSessionPage() {
  const [activeTab, setActiveTab] = useState<TabType>("config")

  const tabs: { key: TabType; label: string }[] = [
    { key: "config", label: "Config" },
    { key: "prompts", label: "Prompts" },
    { key: "status", label: "Status" },
    { key: "history", label: "Histórico" },
  ]

  return (
    <div data-testid="mcp-session-page" className="space-y-6">

      <div className="border-b border-border">
        <div role="tablist" className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "pb-2 px-1 text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={`tab-${tab.key}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" className="mt-6">
        {activeTab === "config" && <SessionConfigTab />}
        {activeTab === "prompts" && <PromptsTab />}
        {activeTab === "status" && <StatusTab />}
        {activeTab === "history" && <HistoryTab />}
      </div>
    </div>
  )
}
