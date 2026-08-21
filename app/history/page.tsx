import Link from "next/link";
import { getPeriodSummaries } from "@/lib/queries";
import { formatRange } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const periods = await getPeriodSummaries();

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold tracking-tight">History</h1>

      {periods.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-faint">
          No weeks logged yet.
        </p>
      ) : (
        <div className="divide-y divide-line overflow-hidden card">
          {periods.map((period, index) => (
            <Link
              key={period.id}
              href={`/history/${period.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-canvas/60"
            >
              <span className="flex items-center gap-2 text-sm">
                {formatRange(period.startDate, period.endDate)}
                {index === 0 && (
                  <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent">
                    current
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs text-muted">
                {period.done}/{period.total} done
                {period.open > 0 && ` · ${period.open} open`}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
