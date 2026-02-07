import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface MultiSelectFilterProps {
  label: string
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
}

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  placeholder = "Selecione...",
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false)

  const handleToggle = (option: string) => {
    const newSelected = selected.includes(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option]
    onChange(newSelected)
  }

  const handleClearAll = () => {
    onChange([])
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <span className="truncate">
              {selected.length > 0 ? (
                <span className="flex items-center gap-1">
                  <span>{placeholder}</span>
                  <Badge variant="secondary" className="ml-1">
                    {selected.length}
                  </Badge>
                </span>
              ) : (
                placeholder
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder={`Buscar ${label.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => handleToggle(option)}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        selected.includes(option)
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </div>
                    <span>{option}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            {selected.length > 0 && (
              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={handleClearAll}
                >
                  Limpar Seleção
                </Button>
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
