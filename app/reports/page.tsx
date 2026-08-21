import { MonthPicker } from "@/app/_components/MonthPicker";
import {
  getAvailableMonths,
  getMonthlyReport,
  STUCK_THRESHOLD,
  UNASSIGNED_LABEL,
  type MonthTaskRow,
} from "@/lib/queries";
import { formatMonth, toMonthKey, todayUTC } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: PageProps<"/reports">) {
  const params = await searchParams;
  const months = await getAvailableMonths();

  const requested = typeof params.month === "string" ? params.month : undefined;
  const selected =
    requested && months.includes(requested)
      ? requested
      : (months[0] ?? toMonthKey(todayUTC()));

  const report = await getMonthlyReport(selected);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">
          {formatMonth(selected)}
        </h1>
        <MonthPicker months={months} selected={selected} />
      </div>

      {report.periodCount === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-faint">
          No weeks logged in this month.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Completed" value={report.totals.completed} />
            <Stat label="Missed" value={report.totals.missed} />
            <Stat label="Total" value={report.totals.total} />
          </div>

          <p className="text-xs text-faint">
            {report.periodCount} {report.periodCount === 1 ? "week" : "weeks"} in
            this month. A task carried across several weeks is listed once.
          </p>

          <TaskSection
            title="Completed"
            count={report.completed.length}
            rows={report.completed}
            emptyText="Nothing completed this month."
            tone="accent"
          />

          <TaskSection
            title="Missed"
            count={report.missed.length}
            rows={report.missed}
            emptyText="Nothing missed this month."
            tone="warn"
            showCarried
          />

          <TaskSection
            title="Stuck"
            hint={`carried ${STUCK_THRESHOLD}x or more, still open`}
            count={report.stuck.length}
            rows={report.stuck}
            emptyText="Nothing stuck."
            tone="warn"
            showCarried
          />
        </>
      )}
    </div>
  );
}

function TaskSection({
  title,
  hint,
  count,
  rows,
  emptyText,
  tone,
  showCarried,
}: {
  title: string;
  hint?: string;
  count: number;
  rows: MonthTaskRow[];
  emptyText: string;
  tone: "accent" | "warn";
  showCarried?: boolean;
}) {
  return (
    <section className="space-y-2">
      <h2 className="flex flex-wrap items-baseline gap-2 text-sm font-medium">
        {title}
        <span className="text-xs font-normal text-faint">
          {count}
          {hint && ` · ${hint}`}
        </span>
      </h2>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-faint">
          {emptyText}
        </p>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm break-words">{row.text}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {/* Owners belong on every row — for a missed task this is the
                      whole point: whose item was it. */}
                  {row.owners.length === 0 ? (
                    <span className="rounded bg-canvas px-1.5 py-0.5 text-[11px] text-muted">
                      {UNASSIGNED_LABEL}
                    </span>
                  ) : (
                    row.owners.map((owner) => (
                      <span
                        key={owner}
                        className={`rounded px-1.5 py-0.5 text-[11px] ${
                          tone === "accent"
                            ? "bg-accent-soft text-accent"
                            : "bg-warn-soft text-warn"
                        }`}
                      >
                        {owner}
                      </span>
                    ))
                  )}
                  {showCarried && row.carriedCount > 0 && (
                    <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[11px] text-warn">
                      carried {row.carriedCount}x
                    </span>
                  )}
                </div>
              </div>
              <span className="shrink-0 text-xs text-faint">{row.weekLabel}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
