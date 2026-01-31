import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"

type NewValidationCtaButtonProps = {
  className?: string
}

export function NewValidationCtaButton({ className }: NewValidationCtaButtonProps) {
  const navigate = useNavigate()

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => navigate("/runs/new")}
      data-testid="btn-new-run"
      className={`bg-white border-gray-300 text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600${className ? ` ${className}` : ""}`}
    >
      Nova Validação
    </Button>
  )
}
