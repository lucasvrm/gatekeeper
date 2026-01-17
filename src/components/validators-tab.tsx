import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ValidatorItem = {
  key: string
  value: string
}

interface ValidatorsTabProps {
  validators: ValidatorItem[]
  actionId: string | null
  activeCount: number
  inactiveCount: number
  onToggle: (name: string, isActive: boolean) => void | Promise<void>
}

export function ValidatorsTab({
  validators,
  actionId,
  activeCount,
  inactiveCount,
  onToggle,
}: ValidatorsTabProps) {
  return (
    <Card className="p-6 bg-card border-border space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Validators</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Toggle validator enforcement for Gatekeeper checks.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Badge variant="default">Active {activeCount}</Badge>
          <Badge variant="secondary">Inactive {inactiveCount}</Badge>
        </div>
      </div>

      {validators.length === 0 ? (
        <div className="text-sm text-muted-foreground">No validators found.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs uppercase tracking-wide">Validator</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Status</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {validators.map((validator) => {
              const isActive = validator.value === "true"
              return (
                <TableRow key={validator.key}>
                  <TableCell className="font-medium">{validator.key}</TableCell>
                  <TableCell>
                    <Badge variant={isActive ? "default" : "secondary"}>
                      {isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={isActive ? "secondary" : "outline"}
                      onClick={() => onToggle(validator.key, !isActive)}
                      disabled={actionId === validator.key}
                    >
                      {isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}
