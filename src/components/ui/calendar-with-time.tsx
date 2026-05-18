import * as React from "react"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Clock2 } from "lucide-react"

export type CalendarWithTimeProps = {
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  defaultStartTime?: string
  defaultEndTime?: string
  className?: string
}

export function CalendarWithTime({
  selected,
  onSelect,
  defaultStartTime = "09:00",
  defaultEndTime = "10:00",
  className,
}: CalendarWithTimeProps) {
  const [internalDate, setInternalDate] = React.useState<Date | undefined>(new Date())
  const [startTime, setStartTime] = React.useState(defaultStartTime)
  const [endTime, setEndTime] = React.useState(defaultEndTime)

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
    <Card className={cn("w-fit", className)}>
      <CardContent className="p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          className="rounded-t-lg"
        />
      </CardContent>
      <CardFooter className="border-t flex gap-4 p-4">
        <div className="flex flex-col gap-1.5 flex-1">
          <Label htmlFor="start-time" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Clock2 className="w-3 h-3" /> Inicio
          </Label>
          <Input
            id="start-time"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="h-9 text-xs rounded-none border-border/50"
          />
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <Label htmlFor="end-time" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Clock2 className="w-3 h-3" /> Fin
          </Label>
          <Input
            id="end-time"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="h-9 text-xs rounded-none border-border/50"
          />
        </div>
      </CardFooter>
    </Card>
  )
}
