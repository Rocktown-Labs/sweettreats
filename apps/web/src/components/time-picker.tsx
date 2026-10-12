import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sweettreats/ui/components/select";
import { Clock } from "lucide-react";

import type { PickupSlot } from "../lib/pickup";

type TimePickerProps = {
  id: string;
  /** 24h "HH:MM", or "" when nothing is chosen. */
  value: string;
  onChange: (value: string) => void;
  slots: PickupSlot[];
  invalid?: boolean;
  describedBy?: string;
};

export function TimePicker({ id, value, onChange, slots, invalid, describedBy }: TimePickerProps) {
  const items = slots.map(({ value: slot, label }) => ({ value: slot, label }));

  return (
    <Select
      items={items}
      value={value || null}
      onValueChange={(next) => onChange(typeof next === "string" ? next : "")}
    >
      <SelectTrigger
        id={id}
        className="picker-trigger"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      >
        <Clock size={18} aria-hidden="true" />
        <SelectValue placeholder="Choose a time" className="picker-value" />
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false} className="picker-popover">
        {slots.map((slot) => (
          <SelectItem key={slot.value} value={slot.value} disabled={slot.disabled}>
            {slot.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
