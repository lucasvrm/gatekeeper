import { useState } from "react"
import { MicroplanCard } from "./microplan-card"
import type { Microplan } from "@/lib/types"

interface MicroplansViewerProps {
  microplans: Microplan[]
  task: string
}

export function MicroplansViewer({ microplans, task }: MicroplansViewerProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  // Return null se não há microplans
  if (microplans.length === 0) {
    return null
  }

  const handleToggle = (index: number) => {
    setOpenIndex((current) => (current === index ? null : index))
  }

  return (
    <div className="space-y-4">
      {/* Header com task description */}
      <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
        <h3 className="text-sm font-semibold mb-1">Tarefa</h3>
        <p className="text-sm text-muted-foreground">{task}</p>
      </div>

      {/* Lista de microplans (accordion mode) */}
      <div className="space-y-3">
        {microplans.map((microplan, index) => (
          <div key={microplan.id} onClick={() => handleToggle(index)}>
            <MicroplanCard
              microplan={microplan}
              defaultOpen={openIndex === index}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
