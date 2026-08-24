"use client";

import type { MemberView } from "@/lib/types";

/** Toggle chips rather than a <select multiple> — one click per owner is the
 *  fastest thing to drive while screen-sharing, and selecting nobody (a shared
 *  team task) is a valid, visible state rather than a hidden default. */
export function OwnerPicker({
  members,
  selected,
  onToggle,
  disabled,
}: {
  members: MemberView[];
  selected: string[];
  onToggle: (memberId: string) => void;
  disabled?: boolean;
}) {
  if (members.length === 0) {
    return <span className="text-xs text-faint">No team members yet</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {members.map((member) => {
        const on = selected.includes(member.id);
        return (
          <button
            key={member.id}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(member.id)}
            aria-pressed={on}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
              on
                ? "border-owner/40 bg-owner-soft font-medium text-owner"
                : "border-line bg-surface text-muted hover:border-faint hover:text-ink"
            }`}
          >
            {member.name}
          </button>
        );
      })}
      {selected.length === 0 && (
        <span className="ml-1 text-xs text-faint">unassigned = team task</span>
      )}
    </div>
  );
}
