import { TaskList } from "./_components/TaskList";
import { FirstPeriodForm, NextPeriodForm } from "./_components/PeriodForms";
import { getActiveMembers, getCurrentPeriod } from "@/lib/queries";
import { addDays, formatRange, toDateInput, todayUTC } from "@/lib/dates";
import type { MemberView, TaskView } from "@/lib/types";

// Always read live — this is the page people sit on during a meeting.
export const dynamic = "force-dynamic";

export default async function CurrentPeriodPage() {
  const [period, members] = await Promise.all([
    getCurrentPeriod(),
    getActiveMembers(),
  ]);

  if (!period) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold tracking-tight">This week</h1>
        <FirstPeriodForm today={toDateInput(todayUTC())} />
      </div>
    );
  }

  const tasks: TaskView[] = period.tasks.map((task) => ({
    id: task.id,
    text: task.text,
    status: task.status,
    priority: task.priority,
    carriedCount: task.carriedCount,
    owners: task.owners.map((o) => ({ id: o.member.id, name: o.member.name })),
  }));

  const memberViews: MemberView[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    active: m.active,
  }));

  const openCount = tasks.filter((t) => t.status === "open").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">
          {formatRange(period.startDate, period.endDate)}
        </h1>
        <NextPeriodForm
          currentEnd={toDateInput(period.endDate)}
          currentEndLabel={formatRange(period.startDate, period.endDate)}
          openCount={openCount}
          suggestedEnd={toDateInput(addDays(period.endDate, 7))}
        />
      </div>

      <TaskList
        periodId={period.id}
        tasks={tasks}
        members={memberViews}
      />
    </div>
  );
}
