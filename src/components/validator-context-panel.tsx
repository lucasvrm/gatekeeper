import { useState } from "react"
import type { ValidatorContext, ValidatorContextFinding } from "@/lib/types"
import { CaretDown, CaretRight, CheckCircle, Info, Warning, XCircle } from "@phosphor-icons/react"

interface ValidatorContextPanelProps {
  context: ValidatorContext
}

const getFindingIcon = (type: ValidatorContextFinding["type"]) => {
  switch (type) {
    case "pass":
      return <CheckCircle className="w-3 h-3 text-status-passed" weight="fill" />
    case "fail":
      return <XCircle className="w-3 h-3 text-status-failed" weight="fill" />
    case "warning":
      return <Warning className="w-3 h-3 text-status-warning" weight="fill" />
    case "info":
      return <Info className="w-3 h-3 text-muted-foreground" weight="fill" />
    default:
      return <span className="w-3 h-3 inline-block text-muted-foreground">.</span>
  }
}

export function ValidatorContextPanel({ context }: ValidatorContextPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div data-testid="validator-context-panel" className="border border-border rounded-lg p-2 bg-card">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full text-left font-medium text-sm flex items-center justify-between"
        aria-expanded={isExpanded}
      >
        <span>Detalhes do Contexto</span>
        {isExpanded ? <CaretDown className="w-4 h-4" /> : <CaretRight className="w-4 h-4" />}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          <div data-testid="context-inputs-section">
            <h4 className="font-semibold text-xs mb-1">Entradas</h4>
            <ul className="text-xs space-y-1">
              {context.inputs.map((input, idx) => (
                <li key={`${input.label}-${idx}`}>
                  <span className="font-medium">{input.label}:</span>{" "}
                  <span>
                    {typeof input.value === "object"
                      ? JSON.stringify(input.value)
                      : String(input.value)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div data-testid="context-analyzed-section">
            <h4 className="font-semibold text-xs mb-1">Analisados</h4>
            <div className="space-y-2 text-xs">
              {context.analyzed.map((group, idx) => (
                <div key={`${group.label}-${idx}`}>
                  <div className="font-medium">{group.label}:</div>
                  <ul className="ml-4 list-disc">
                    {group.items.map((item, itemIdx) => (
                      <li key={`${group.label}-${itemIdx}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div data-testid="context-findings-section">
            <h4 className="font-semibold text-xs mb-1">Resultados</h4>
            <ul className="text-xs space-y-1">
              {context.findings.map((finding, idx) => (
                <li key={`${finding.type}-${idx}`} data-testid={`finding-${finding.type}`}>
                  <span className="mr-1 inline-flex items-center">{getFindingIcon(finding.type)}</span>
                  <span>{finding.message}</span>
                  {finding.location && (
                    <span className="text-muted-foreground ml-1">em {finding.location}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div data-testid="context-reasoning-section">
            <h4 className="font-semibold text-xs mb-1">Raciocínio</h4>
            <p className="text-xs text-muted-foreground">{context.reasoning}</p>
          </div>
        </div>
      )}
    </div>
  )
}
