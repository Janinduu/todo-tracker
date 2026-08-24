import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { formatRange, monthBounds, toMonthKey } from "@/lib/dates";

export const UNASSIGNED_LABEL = "Team";
export const STUCK_THRESHOLD = 3;

const taskInclude = {
  owners: { include: { member: true } },
} as const;

// High → medium → low, then oldest first within a level. The TaskPriority enum
// is declared low→high in the schema, so "desc" puts high at the top.
const TASK_ORDER: Prisma.TaskOrderByWithRelationInput[] = [
  { priority: "desc" },
  { createdAt: "asc" },
];

export type TaskWithOwners = Awaited<
  ReturnType<typeof prisma.task.findMany<{ include: typeof taskInclude }>>
>[number];

/** The active week — always the one with the latest meeting date. */
export async function getCurrentPeriod() {
  return prisma.period.findFirst({
    orderBy: { endDate: "desc" },
    include: { tasks: { include: taskInclude, orderBy: TASK_ORDER } },
  });
}

export async function getPeriod(periodId: string) {
  return prisma.period.findUnique({
    where: { id: periodId },
    include: { tasks: { include: taskInclude, orderBy: TASK_ORDER } },
  });
}

/** Every week, newest first, with done/open counts for the history list. */
export async function getPeriodSummaries() {
  const periods = await prisma.period.findMany({
    orderBy: { endDate: "desc" },
    include: { tasks: { select: { status: true } } },
  });

  return periods.map((period) => ({
    id: period.id,
    startDate: period.startDate,
    endDate: period.endDate,
    done: period.tasks.filter((t) => t.status === "done").length,
    open: period.tasks.filter((t) => t.status === "open").length,
    total: period.tasks.length,
  }));
}

export async function getActiveMembers() {
  return prisma.teamMember.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
}

export async function getAllMembers() {
  return prisma.teamMember.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

/* ---------------------------------------------------------------- reports */

export type MonthTaskRow = {
  id: string;
  text: string;
  /** Empty means nobody was assigned — a shared team task. */
  owners: string[];
  /** The week it was finished in, or the week it currently sits in. */
  weekLabel: string;
  carriedCount: number;
};

export type StuckRow = MonthTaskRow;

export type MonthlyReport = {
  monthKey: string;
  periodCount: number;
  totals: { completed: number; missed: number; total: number };
  completed: MonthTaskRow[];
  missed: MonthTaskRow[];
  stuck: StuckRow[];
};

/**
 * Monthly summary (PRD §6.5).
 *
 * Reports the work itself — every task completed and every task missed, each
 * labelled with whoever owned it — rather than per-person totals.
 *
 * Rows are deduplicated by lineage. A to-do carried across three weeks of the
 * same month exists as three Task rows, and listing rows would show it three
 * times. Grouping on `originTaskId ?? id` collapses each chain back to the one
 * real to-do it represents.
 */
export async function getMonthlyReport(monthKey: string): Promise<MonthlyReport> {
  const { start, end } = monthBounds(monthKey);

  // Any week that overlaps the month at all, even partially.
  const periods = await prisma.period.findMany({
    where: { startDate: { lte: end }, endDate: { gte: start } },
    orderBy: { endDate: "asc" },
  });

  if (periods.length === 0) {
    return {
      monthKey,
      periodCount: 0,
      totals: { completed: 0, missed: 0, total: 0 },
      completed: [],
      missed: [],
      stuck: [],
    };
  }

  const periodOrder = new Map(periods.map((p, i) => [p.id, i]));
  const periodLabel = new Map(
    periods.map((p) => [p.id, formatRange(p.startDate, p.endDate)]),
  );

  const tasks = await prisma.task.findMany({
    where: { periodId: { in: periods.map((p) => p.id) } },
    include: taskInclude,
  });

  // Collapse each carry-forward chain into a single logical to-do.
  const chains = new Map<string, TaskWithOwners[]>();
  for (const task of tasks) {
    const key = task.originTaskId ?? task.id;
    const chain = chains.get(key);
    if (chain) chain.push(task);
    else chains.set(key, [task]);
  }

  const toRow = (task: TaskWithOwners): MonthTaskRow => ({
    id: task.id,
    text: task.text,
    owners: task.owners.map((o) => o.member.name).sort(),
    weekLabel: periodLabel.get(task.periodId) ?? "",
    carriedCount: task.carriedCount,
  });

  const completed: MonthTaskRow[] = [];
  const missed: MonthTaskRow[] = [];

  for (const chain of chains.values()) {
    chain.sort(
      (a, b) => (periodOrder.get(a.periodId) ?? 0) - (periodOrder.get(b.periodId) ?? 0),
    );

    // A done task is never carried further, so the completed row is always the
    // last one in the chain when it exists at all.
    const doneRow = chain.find((t) => t.status === "done");
    if (doneRow) completed.push(toRow(doneRow));
    else missed.push(toRow(chain[chain.length - 1]));
  }

  // Completed reads chronologically; missed leads with whatever is most overdue.
  completed.sort(
    (a, b) => a.weekLabel.localeCompare(b.weekLabel) || a.text.localeCompare(b.text),
  );
  missed.sort(
    (a, b) => b.carriedCount - a.carriedCount || a.text.localeCompare(b.text),
  );

  // Stuck items reflect current state, so they come from the most recent week
  // in this month rather than from every week in it.
  const lastPeriodId = periods[periods.length - 1].id;
  const stuck = missed.filter((row) => {
    const task = tasks.find((t) => t.id === row.id);
    return task?.periodId === lastPeriodId && row.carriedCount >= STUCK_THRESHOLD;
  });

  return {
    monthKey,
    periodCount: periods.length,
    totals: {
      completed: completed.length,
      missed: missed.length,
      total: completed.length + missed.length,
    },
    completed,
    missed,
    stuck,
  };
}

/** Month keys that actually contain data, newest first, for the picker. */
export async function getAvailableMonths(): Promise<string[]> {
  const bounds = await prisma.period.aggregate({
    _min: { startDate: true },
    _max: { endDate: true },
  });

  const first = bounds._min.startDate;
  const last = bounds._max.endDate;
  const now = new Date();
  const currentKey = toMonthKey(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
  );

  if (!first || !last) return [currentKey];

  const keys: string[] = [];
  const cursor = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1),
  );
  const stop = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1));

  while (cursor <= stop) {
    keys.push(toMonthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  if (!keys.includes(currentKey)) keys.push(currentKey);
  return keys.reverse();
}
