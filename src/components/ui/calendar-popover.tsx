import * as React from "react"
import { format } from "date-fns"
import { formatDate } from "@/lib/format-utils"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { CalendarSingle } from "@/components/ui/calendar-single"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export type CalendarPopoverProps = {
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  disabled?: any
  placeholder?: string
  className?: string
}

export function CalendarPopover({
  selected,
  onSelect,
  disabled,
  placeholder = "Seleccionar fecha",
  className,
  ...props
}: CalendarPopoverProps) {
  const [internalDate, setInternalDate] = React.useState<Date | undefined>()
  const [open, setOpen] = React.useState(false)

  const isControlled = selected !== undefined
  const date = isControlled ? selected : internalDate

  const handleSelect = (newDate: Date | undefined) => {
    if (isControlled) {
      onSelect?.(newDate)
    } else {
      setInternalDate(newDate)
      onSelect?.(newDate)
    }
    setOpen(false)
  }

  // Filter out asChild to avoid React warning on DOM elements
  // and avoid nested buttons by using the render prop pattern of Base UI
  const { asChild, ...triggerProps } = props as any;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        {...triggerProps}
        render={(pProps) => (
          <Button
            {...pProps}
            variant={"outline"}
            className={cn(
              "w-[240px] justify-start text-left font-normal h-10 rounded-none border-border/50",
              !date && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
            {date ? formatDate(date) : <span>{placeholder}</span>}
          </Button>
        )}
      />
      <PopoverContent className="w-auto p-0 border-border/50" align="start">
        <CalendarSingle
          selected={date}
          onSelect={handleSelect}
          disabled={disabled}
          className="p-0"
        />
      </PopoverContent>
    </Popover>
  )
}
