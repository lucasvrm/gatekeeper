import { useCallback, useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { LLMAgent } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import CheckCircleIcon from "lucide-react/dist/esm/icons/check-circle"
import Loader2Icon from "lucide-react/dist/esm/icons/loader-2"
import XCircleIcon from "lucide-react/dist/esm/icons/x-circle"
import { toast } from "sonner"

type TestStatus = "idle" | "testing" | "success" | "error"

interface AgentTestDialogProps {
  agent?: LLMAgent
  onClose: () => void
}

export function AgentTestDialog({ agent, onClose }: AgentTestDialogProps) {
  const [status, setStatus] = useState<TestStatus>("idle")
  const [message, setMessage] = useState("")
  const [latencyMs, setLatencyMs] = useState<number | null>(null)

  const runTest = useCallback(async () => {
    if (!agent) return
    setStatus("testing")
    setMessage("Testing connection...")
    setLatencyMs(null)

    try {
      const result = await api.agents.test(agent.id)
      setLatencyMs(result.latencyMs)
      if (result.ok) {
        setStatus("success")
        setMessage("Connection successful")
      } else {
        setStatus("error")
        setMessage("Connection failed")
      }
    } catch (error) {
      console.error("Agent test failed:", error)
      setStatus("error")
      setMessage("Unable to test connection")
      toast.error("Failed to test agent")
    }
  }, [agent])

  useEffect(() => {
    if (agent) {
      runTest()
    } else {
      setStatus("idle")
      setMessage("")
      setLatencyMs(null)
    }
  }, [agent, runTest])

  const statusIcon = () => {
    if (status === "testing") {
      return <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
    }
    if (status === "success") {
      return <CheckCircleIcon className="h-6 w-6 text-green-500" />
    }
    if (status === "error") {
      return <XCircleIcon className="h-6 w-6 text-red-500" />
    }
    return null
  }

  return (
    <Dialog open={Boolean(agent)} onOpenChange={(isOpen) => (!isOpen ? onClose() : null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Test Agent</DialogTitle>
          <DialogDescription>
            {agent ? `Testing ${agent.name}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          {statusIcon()}
          <div className="space-y-1">
            <div className="text-sm font-medium">
              {message || "Ready to test"}
            </div>
            {latencyMs !== null ? (
              <div className="text-xs text-muted-foreground">
                Latency: {latencyMs}ms
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={runTest} disabled={status === "testing" || !agent}>
            {status === "testing" ? "Testing..." : "Test Again"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
