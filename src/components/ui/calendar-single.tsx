import * as React from "react"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { formatDate } from "@/lib/format-utils"

export type CalendarSingleProps = {
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  disabled?: any
  className?: string
}

export function CalendarSingle({
  selected,
  onSelect,
  disabled,
  className,
}: CalendarSingleProps) {
  const [internalDate, setInternalDate] = React.useState<Date | undefined>(new Date())
  
  const isControlled = selected !== undefined
  const date = isControlled ? selected : internalDate
  const handleSelect = (newDate: Date | undefined) => {
    if (isControlled) {
      onSelect?.(newDate)
    } else {
      setInternalDate(newDate)
      onSelect?.(newDate)
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Calendar
        mode="single"
        selected={date}
        onSelect={handleSelect}
        captionLayout="dropdown"
        disabled={disabled}
        className="rounded-lg border"
      />
      {date && (
        <p className="text-sm text-muted-foreground text-center">
          {formatDate(date)}
        </p>
      )}
    </div>
  )
}
