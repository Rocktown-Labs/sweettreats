import { Calendar } from "@sweettreats/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@sweettreats/ui/components/popover";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useState } from "react";

import { formatPickupDate, parseIsoDate, toIsoDate } from "../lib/pickup";

type DatePickerProps = {
  id: string;
  /** ISO "YYYY-MM-DD", or "" when nothing is chosen. */
  value: string;
  onChange: (value: string) => void;
  min: string;
  max: string;
  invalid?: boolean;
  describedBy?: string;
};

export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  invalid,
  describedBy,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const minDate = parseIsoDate(min);
  const maxDate = parseIsoDate(max);
  const selected = value ? parseIsoDate(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        className="picker-trigger"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        data-empty={value ? undefined : ""}
      >
        <CalendarDays size={18} aria-hidden="true" />
        <span className="picker-value">{value ? formatPickupDate(value) : "Choose a date"}</span>
        <ChevronDown size={16} aria-hidden="true" className="picker-chevron" />
      </PopoverTrigger>
      <PopoverContent align="start" className="picker-popover w-auto p-2">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? minDate}
          startMonth={minDate}
          endMonth={maxDate}
          disabled={{ before: minDate, after: maxDate }}
          onSelect={(date) => {
            if (date) {
              onChange(toIsoDate(date));
              setOpen(false);
            }
          }}
          className="[--cell-radius:0.5rem] [--cell-size:--spacing(10)]"
        />
      </PopoverContent>
    </Popover>
  );
}
