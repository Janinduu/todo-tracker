// Priority is shown with a colour AND a word everywhere it appears. Colour
// alone would be unreadable for anyone with red/green colour blindness, which
// is exactly the pair this scale uses.

export const PRIORITIES = ["high", "medium", "low"] as const;

export type Priority = (typeof PRIORITIES)[number];

export const DEFAULT_PRIORITY: Priority = "medium";

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Chip styling — soft background, readable text, matching border. */
export const PRIORITY_CHIP: Record<Priority, string> = {
  high: "bg-prio-high-soft text-prio-high border-prio-high/30",
  medium: "bg-prio-mid-soft text-prio-mid border-prio-mid/30",
  low: "bg-prio-low-soft text-prio-low border-prio-low/30",
};

/** The 3px stripe down the left edge of a task row, for fast scanning. */
export const PRIORITY_STRIPE: Record<Priority, string> = {
  high: "bg-prio-high",
  medium: "bg-prio-mid",
  low: "bg-prio-low",
};

export function isPriority(value: unknown): value is Priority {
  return (
    typeof value === "string" && (PRIORITIES as readonly string[]).includes(value)
  );
}
