import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sweettreats/ui/components/select";
import { MapPin } from "lucide-react";

import type { PublicPickupLocation } from "../lib/api";

type LocationPickerProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  locations: PublicPickupLocation[];
  invalid?: boolean;
  describedBy?: string;
};

export function LocationPicker({
  id,
  value,
  onChange,
  locations,
  invalid,
  describedBy,
}: LocationPickerProps) {
  const items = locations.map((loc) => ({ value: loc.id, label: loc.name }));

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
        <MapPin size={18} aria-hidden="true" />
        <SelectValue placeholder="Choose a pickup spot" className="picker-value" />
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false} className="picker-popover">
        {locations.map((loc) => (
          <SelectItem key={loc.id} value={loc.id}>
            <div>
              <div style={{ fontWeight: 650 }}>{loc.name}</div>
              <div style={{ fontSize: "0.8rem", color: "#6e4422", marginTop: "2px" }}>
                {loc.address}
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
