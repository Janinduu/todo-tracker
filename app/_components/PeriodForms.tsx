"use client";

import { useState, useTransition } from "react";
import { createFirstPeriod, startNextPeriod } from "@/lib/actions";

/** Shown only when the database has no periods at all. */
export function FirstPeriodForm({ today }: { today: string }) {
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createFirstPeriod(startDate, endDate);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <h2 className="text-sm font-medium">Start the first week</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        <Field label="From">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="Meeting date">
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </Field>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Create
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-warn">{error}</p>}
    </div>
  );
}

/** "Log next meeting" — creates the next period and carries open items over. */
export function NextPeriodForm({
  currentEnd,
  currentEndLabel,
  openCount,
  suggestedEnd,
}: {
  currentEnd: string;
  currentEndLabel: string;
  openCount: number;
  suggestedEnd: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [endDate, setEndDate] = useState(suggestedEnd);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await startNextPeriod(endDate);
      if (!result.ok) setError(result.error);
      else setExpanded(false);
    });
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-muted hover:border-faint hover:text-ink"
      >
        Log next meeting
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-line bg-surface p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <Field label="From">
          {/* Not editable — the new week always begins where this one ended,
              which is what keeps the timeline continuous. */}
          <input
            type="date"
            value={currentEnd}
            readOnly
            disabled
            className="rounded-md border border-line bg-canvas px-3 py-2 text-sm text-muted"
          />
        </Field>
        <Field label="Next meeting date">
          <input
            type="date"
            value={endDate}
            min={currentEnd}
            onChange={(e) => setEndDate(e.target.value)}
            autoFocus
            className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </Field>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {pending ? "Creating…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          disabled={pending}
          className="rounded-md border border-line px-3 py-2 text-sm text-muted"
        >
          Cancel
        </button>
      </form>

      <p className="mt-3 text-xs text-muted">
        {openCount === 0 ? (
          <>Nothing open in {currentEndLabel} — the new week starts empty.</>
        ) : (
          <>
            {openCount} open {openCount === 1 ? "item" : "items"} will carry
            forward. Completed items stay in {currentEndLabel}.
          </>
        )}
      </p>

      {error && <p className="mt-2 text-sm text-warn">{error}</p>}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}
