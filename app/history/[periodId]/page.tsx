import Link from "next/link";
import { notFound } from "next/navigation";
import { TaskList } from "@/app/_components/TaskList";
import { getActiveMembers, getCurrentPeriod, getPeriod } from "@/lib/queries";
import { formatRange } from "@/lib/dates";
import type { MemberView, TaskView } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PeriodDetailPage({
  params,
}: PageProps<"/history/[periodId]">) {
  const { periodId } = await params;

  const [period, members, current] = await Promise.all([
    getPeriod(periodId),
    getActiveMembers(),
    getCurrentPeriod(),
  ]);

  if (!period) notFound();

  const isCurrent = current?.id === period.id;

  const tasks: TaskView[] = period.tasks.map((task) => ({
    id: task.id,
    text: task.text,
    status: task.status,
    carriedCount: task.carriedCount,
    owners: task.owners.map((o) => ({ id: o.member.id, name: o.member.name })),
  }));

  const memberViews: MemberView[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    active: m.active,
  }));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/history" className="text-xs text-muted hover:text-ink">
          ← History
        </Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">
          {formatRange(period.startDate, period.endDate)}
        </h1>
      </div>

      <TaskList
        periodId={period.id}
        tasks={tasks}
        members={memberViews}
        readOnlyNotice={
          isCurrent
            ? undefined
            : "Past week — edits here are for corrections and will change the reports."
        }
      />
    </div>
  );
}
