import { MonthChart, type ChartRow } from "@/app/_components/MonthChart";
import { MonthPicker } from "@/app/_components/MonthPicker";
import { getAvailableMonths, getMonthlyReport, STUCK_THRESHOLD } from "@/lib/queries";
import { toMonthKey, todayUTC } from "@/lib/dates";

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

  const chartData: ChartRow[] = report.people.map((person) => ({
    name: person.name,
    completed: person.completed,
    missed: person.missed,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Monthly summary</h1>
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
            <Stat label="Still open" value={report.totals.missed} />
            <Stat label="Total" value={report.totals.total} />
          </div>

          <p className="text-xs text-faint">
            {report.periodCount} {report.periodCount === 1 ? "week" : "weeks"} in
            this month. A task carried across several weeks counts once.
          </p>

          <MonthChart data={chartData} />

          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2 font-medium">Person</th>
                  <th className="px-4 py-2 text-right font-medium">Assigned</th>
                  <th className="px-4 py-2 text-right font-medium">Completed</th>
                  <th className="px-4 py-2 text-right font-medium">Missed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {report.people.map((person) => (
                  <tr key={person.id}>
                    <td className="px-4 py-2">
                      {person.name}
                      {!person.active && (
                        <span className="ml-2 text-xs text-faint">inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {person.assigned}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {person.completed}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {person.missed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-medium">
              Stuck items
              <span className="ml-2 text-xs font-normal text-faint">
                carried {STUCK_THRESHOLD}x or more, still open
              </span>
            </h2>
            {report.stuck.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-faint">
                Nothing stuck.
              </p>
            ) : (
              <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                {report.stuck.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start justify-between gap-4 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm break-words">{task.text}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {task.owners.length === 0
                          ? "Team"
                          : task.owners.join(", ")}
                      </p>
                    </div>
                    <span className="shrink-0 rounded bg-warn-soft px-1.5 py-0.5 text-[11px] text-warn">
                      carried {task.carriedCount}x
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
