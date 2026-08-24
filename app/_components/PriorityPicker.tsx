"use client";

import {
  PRIORITIES,
  PRIORITY_CHIP,
  PRIORITY_LABEL,
  type Priority,
} from "@/lib/priority";

/** Three toggle chips, ordered high → low to match how the list is sorted. */
export function PriorityPicker({
  value,
  onChange,
  disabled,
}: {
  value: Priority;
  onChange: (next: Priority) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRIORITIES.map((priority) => {
        const on = value === priority;
        return (
          <button
            key={priority}
            type="button"
            disabled={disabled}
            onClick={() => onChange(priority)}
            aria-pressed={on}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
              on
                ? `${PRIORITY_CHIP[priority]} font-medium`
                : "border-line bg-surface text-muted hover:border-faint hover:text-ink"
            }`}
          >
            {PRIORITY_LABEL[priority]}
          </button>
        );
      })}
    </div>
  );
}

/** Read-only badge for a task row. */
export function PriorityChip({ priority }: { priority: Priority }) {
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[11px] ${PRIORITY_CHIP[priority]}`}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
