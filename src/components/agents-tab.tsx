import { useCallback, useEffect, useMemo, useState } from "react"
import { api } from "@/lib/api"
import type { LLMAgent } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AgentFormDialog } from "@/components/agent-form-dialog"
import { AgentTestDialog } from "@/components/agent-test-dialog"
import { toast } from "sonner"

const PROVIDER_BADGE_CLASSES: Record<string, string> = {
  anthropic: "bg-orange-100 text-orange-800",
  openai: "bg-emerald-100 text-emerald-800",
  google: "bg-blue-100 text-blue-800",
  ollama: "bg-purple-100 text-purple-800",
}

export function AgentsTab() {
  const [agents, setAgents] = useState<LLMAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<LLMAgent | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<LLMAgent | null>(null)
  const [testingAgent, setTestingAgent] = useState<LLMAgent | null>(null)

  const loadAgents = useCallback(async () => {
    setLoading(true)
    try {
      const list = await api.agents.list()
      setAgents(list)
    } catch (error) {
      console.error("Failed to load agents:", error)
      toast.error("Failed to load agents")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  const activeCount = useMemo(
    () => agents.filter((agent) => agent.isActive).length,
    [agents]
  )

  const handleToggleActive = async (agent: LLMAgent, next: boolean) => {
    setActionId(agent.id)
    try {
      const updated = await api.agents.update(agent.id, { isActive: next })
      setAgents((prev) => prev.map((item) => (item.id === agent.id ? updated : item)))
      toast.success("Agent updated")
    } catch (error) {
      console.error("Failed to update agent:", error)
      toast.error("Failed to update agent")
    } finally {
      setActionId(null)
    }
  }

  const handleSetDefault = async (agent: LLMAgent) => {
    setActionId(agent.id)
    try {
      await api.agents.setDefault(agent.id)
      await loadAgents()
      toast.success("Default agent updated")
    } catch (error) {
      console.error("Failed to set default agent:", error)
      toast.error("Failed to set default agent")
    } finally {
      setActionId(null)
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    setActionId(pendingDelete.id)
    try {
      await api.agents.delete(pendingDelete.id)
      setAgents((prev) => prev.filter((item) => item.id !== pendingDelete.id))
      toast.success("Agent deleted")
    } catch (error) {
      console.error("Failed to delete agent:", error)
      const message = error instanceof Error ? error.message : "Failed to delete agent"
      toast.error(message)
    } finally {
      setActionId(null)
      setPendingDelete(null)
      setDeleteConfirmOpen(false)
    }
  }

  const openCreate = () => {
    setEditingAgent(null)
    setFormOpen(true)
  }

  const openEdit = (agent: LLMAgent) => {
    setEditingAgent(agent)
    setFormOpen(true)
  }

  const openDelete = (agent: LLMAgent) => {
    setPendingDelete(agent)
    setDeleteConfirmOpen(true)
  }

  const openTest = (agent: LLMAgent) => {
    setTestingAgent(agent)
  }

  if (loading) {
    return (
      <Card className="p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-72" />
        <div className="space-y-2">
          {[1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Agents</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage LLM agents used by the elicitor.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Badge variant="default">Active {activeCount}</Badge>
            <Badge variant="secondary">Inactive {agents.length - activeCount}</Badge>
          </div>
        </div>
        <Button onClick={openCreate}>New Agent</Button>
      </div>

      {agents.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No agents configured yet.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs uppercase tracking-wide">Name</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Provider</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Model</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Status</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Default</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => {
              const badgeClass = PROVIDER_BADGE_CLASSES[agent.provider] ?? ""
              return (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">{agent.name}</TableCell>
                  <TableCell>
                    <Badge className={badgeClass}>{agent.provider}</Badge>
                  </TableCell>
                  <TableCell>{agent.model}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={agent.isActive}
                        onCheckedChange={(value) => handleToggleActive(agent, value)}
                        disabled={actionId === agent.id}
                      />
                      <span className="text-sm text-muted-foreground">
                        {agent.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={agent.isDefault ? "default" : "secondary"}>
                      {agent.isDefault ? "Default" : "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => openEdit(agent)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => handleSetDefault(agent)}
                          disabled={agent.isDefault || actionId === agent.id}
                        >
                          Set as default
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openTest(agent)}>
                          Test connection
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => openDelete(agent)}
                          className="text-destructive focus:text-destructive"
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      <AgentFormDialog
        open={formOpen}
        agent={editingAgent ?? undefined}
        onClose={() => {
          setFormOpen(false)
          setEditingAgent(null)
          loadAgents()
        }}
      />

      <AgentTestDialog
        agent={testingAgent ?? undefined}
        onClose={() => setTestingAgent(null)}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The agent will be removed from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={!pendingDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
