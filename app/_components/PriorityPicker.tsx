"use client";

import { useId } from "react";
import {
  PRIORITIES,
  PRIORITY_CHIP,
  PRIORITY_FULL,
  type Priority,
} from "@/lib/priority";

/**
 * A labelled dropdown rather than a row of toggle chips. Three chip groups
 * side by side (owners, then priority) read as one undifferentiated strip —
 * a select with its own visible label makes the two settings distinct.
 */
export function PrioritySelect({
  value,
  onChange,
  disabled,
}: {
  value: Priority;
  onChange: (next: Priority) => void;
  disabled?: boolean;
}) {
  const id = useId();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs whitespace-nowrap text-muted">
        Priority
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as Priority)}
        // Tinted to match the level so the current setting is readable without
        // opening the menu.
        className={`rounded-md border px-2.5 py-1.5 text-xs font-medium outline-none focus:border-accent disabled:opacity-50 ${PRIORITY_CHIP[value]}`}
      >
        {PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {PRIORITY_FULL[priority]}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Read-only badge for a task row — spelled out, never a bare "High". */
export function PriorityChip({ priority }: { priority: Priority }) {
  return (
    <span
      className={`rounded border px-2 py-0.5 text-[11px] whitespace-nowrap ${PRIORITY_CHIP[priority]}`}
    >
      {PRIORITY_FULL[priority]}
    </span>
  );
}
