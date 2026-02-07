import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronRight, File, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Microplan } from "@/lib/types"

interface MicroplanCardProps {
  microplan: Microplan
  defaultOpen?: boolean
}

const ACTION_STYLES = {
  CREATE: "bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400",
  EDIT: "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400",
  DELETE: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400",
} as const

export function MicroplanCard({ microplan, defaultOpen = false }: MicroplanCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Card className="overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger className="flex w-full items-center gap-3 text-left hover:opacity-70 transition-opacity">
            <div className="flex-shrink-0">
              {isOpen ? (
                <ChevronDown className="size-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 text-muted-foreground" />
              )}
            </div>
            <Badge variant="outline" className="font-mono text-xs shrink-0">
              {microplan.id}
            </Badge>
            <CardTitle className="text-sm font-medium flex-1">
              {microplan.goal}
            </CardTitle>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Files */}
            {microplan.files.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Arquivos</p>
                <div className="space-y-1.5">
                  {microplan.files.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 rounded-lg border border-border/40 bg-muted/20 p-2.5 text-xs"
                    >
                      <File className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-xs truncate flex-1">
                            {file.path}
                          </code>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-1.5 py-0",
                              ACTION_STYLES[file.action]
                            )}
                          >
                            {file.action}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{file.what}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Verify */}
            {microplan.verify && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">Verificação</p>
                </div>
                <div className="rounded-lg border border-border/40 bg-muted/30 p-2.5">
                  <code className="font-mono text-xs text-foreground">
                    {microplan.verify}
                  </code>
                </div>
              </div>
            )}

            {/* Dependencies */}
            {microplan.depends_on.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Dependências</p>
                <div className="flex flex-wrap gap-1.5">
                  {microplan.depends_on.map((dep) => (
                    <Badge
                      key={dep}
                      variant="secondary"
                      className="font-mono text-[10px] px-2"
                    >
                      {dep}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
