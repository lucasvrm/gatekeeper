import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { Gate, Validator } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { CaretDown, CaretRight, ShieldCheck } from "@phosphor-icons/react"

export function GatesPage() {
  const [gates, setGates] = useState<Gate[]>([])
  const [validators, setValidators] = useState<Record<number, Validator[]>>({})
  const [expandedGates, setExpandedGates] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadingValidators, setLoadingValidators] = useState<Set<number>>(new Set())

  useEffect(() => {
    const loadGates = async () => {
      setLoading(true)
      try {
        const data = await api.gates.list()
        setGates(data)
      } catch (error) {
        console.error("Failed to load gates:", error)
      } finally {
        setLoading(false)
      }
    }

    loadGates()
  }, [])

  const toggleGate = async (gateNumber: number) => {
    const isExpanded = expandedGates.has(gateNumber)

    if (isExpanded) {
      setExpandedGates((prev) => {
        const next = new Set(prev)
        next.delete(gateNumber)
        return next
      })
    } else {
      setExpandedGates((prev) => new Set(prev).add(gateNumber))

      if (!validators[gateNumber]) {
        setLoadingValidators((prev) => new Set(prev).add(gateNumber))
        try {
          const data = await api.gates.getValidators(gateNumber)
          setValidators((prev) => ({ ...prev, [gateNumber]: data }))
        } catch (error) {
          console.error("Failed to load validators:", error)
        } finally {
          setLoadingValidators((prev) => {
            const next = new Set(prev)
            next.delete(gateNumber)
            return next
          })
        }
      }
    }
  }

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Validation Gates</h1>
        <p className="text-muted-foreground mt-1">
          Visão geral de todos os validation gates e seus validators
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {gates.map((gate) => {
          const isExpanded = expandedGates.has(gate.number)
          const isLoadingValidators = loadingValidators.has(gate.number)
          const gateValidators = validators[gate.number] || []

          return (
            <Card key={gate.number} className="bg-card border-border overflow-hidden">
              <button
                onClick={() => toggleGate(gate.number)}
                className="w-full p-6 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="text-4xl">{gate.emoji}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-xl font-semibold">{gate.name}</h2>
                        <span className="text-xs font-mono text-muted-foreground">
                          Gate {gate.number}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {gate.description}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {gate.validatorCount}{" "}
                          {gate.validatorCount === 1 ? "Validator" : "Validators"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {isExpanded ? (
                    <CaretDown className="w-5 h-5 text-muted-foreground flex-shrink-0 ml-2" />
                  ) : (
                    <CaretRight className="w-5 h-5 text-muted-foreground flex-shrink-0 ml-2" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-6 pb-6 border-t border-border pt-4">
                  {isLoadingValidators ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-20" />
                      ))}
                    </div>
                  ) : gateValidators.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum validator encontrado
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {gateValidators
                        .sort((a, b) => a.order - b.order)
                        .map((validator) => (
                          <div
                            key={validator.code}
                            className="p-4 bg-muted/30 rounded-lg border border-border"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <ShieldCheck
                                  className={`w-4 h-4 ${
                                    validator.isHardBlock
                                      ? "text-destructive"
                                      : "text-status-warning"
                                  }`}
                                  weight="fill"
                                />
                                <h3 className="font-semibold">{validator.name}</h3>
                              </div>
                              <Badge
                                variant={validator.isHardBlock ? "destructive" : "secondary"}
                                className="text-xs"
                              >
                                {validator.isHardBlock ? "Hard Block" : "Soft Gate"}
                              </Badge>
                            </div>
                            <p className="text-xs font-mono text-muted-foreground mb-2">
                              {validator.code}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {validator.description}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
