import * as React from "react"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { formatDate } from "@/lib/format-utils"
import { DateRange } from "react-day-picker"

export type CalendarRangeProps = {
  selected?: DateRange
  onSelect?: (range: DateRange | undefined) => void
  className?: string
}

export function CalendarRange({
  selected,
  onSelect,
  className,
}: CalendarRangeProps) {
  const [internalRange, setInternalRange] = React.useState<DateRange | undefined>({
    from: new Date(),
    to: undefined,
  })

  const isControlled = selected !== undefined
  const range = isControlled ? selected : internalRange
  const handleSelect = (newRange: DateRange | undefined) => {
    if (isControlled) {
      onSelect?.(newRange)
    } else {
      setInternalRange(newRange)
      onSelect?.(newRange)
    }
  }

  const formatRange = (range: DateRange | undefined) => {
    if (!range?.from) return "Seleccionar rango"
    if (!range.to) return `${formatDate(range.from)} → ...`
    return `${formatDate(range.from)} → ${formatDate(range.to)}`
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Calendar
        mode="range"
        selected={range}
        onSelect={handleSelect}
        numberOfMonths={2}
        className="rounded-lg border"
      />
      <p className="text-sm text-muted-foreground text-center">
        {formatRange(range)}
      </p>
    </div>
  )
}
