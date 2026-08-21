import { prisma } from "@/lib/prisma";
import { monthBounds, toMonthKey } from "@/lib/dates";

export const UNASSIGNED = "__unassigned__";
export const STUCK_THRESHOLD = 3;

const taskInclude = {
  owners: { include: { member: true } },
} as const;

export type TaskWithOwners = Awaited<
  ReturnType<typeof prisma.task.findMany<{ include: typeof taskInclude }>>
>[number];

/** The active week — always the one with the latest meeting date. */
export async function getCurrentPeriod() {
  return prisma.period.findFirst({
    orderBy: { endDate: "desc" },
    include: { tasks: { include: taskInclude, orderBy: { createdAt: "asc" } } },
  });
}

export async function getPeriod(periodId: string) {
  return prisma.period.findUnique({
    where: { id: periodId },
    include: { tasks: { include: taskInclude, orderBy: { createdAt: "asc" } } },
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

export async function countOpenTasksInCurrentPeriod(): Promise<number> {
  const latest = await prisma.period.findFirst({ orderBy: { endDate: "desc" } });
  if (!latest) return 0;
  return prisma.task.count({ where: { periodId: latest.id, status: "open" } });
}

/* ---------------------------------------------------------------- reports */

export type PersonRow = {
  id: string;
  name: string;
  active: boolean;
  assigned: number;
  completed: number;
  missed: number;
};

export type StuckRow = {
  id: string;
  text: string;
  carriedCount: number;
  owners: string[];
};

export type MonthlyReport = {
  monthKey: string;
  periodCount: number;
  totals: { completed: number; missed: number; total: number };
  people: PersonRow[];
  stuck: StuckRow[];
};

/**
 * Monthly summary (PRD §6.5).
 *
 * Counts are deduplicated by lineage, not by row. A to-do carried across three
 * weeks of the same month exists as three Task rows, and counting rows would
 * report it as three separate items — inflating both "assigned" and "missed"
 * for whoever owns it. Grouping on `originTaskId ?? id` collapses each chain
 * back to the one real to-do it represents.
 */
export async function getMonthlyReport(monthKey: string): Promise<MonthlyReport> {
  const { start, end } = monthBounds(monthKey);

  // Any week that overlaps the month at all, even partially.
  const periods = await prisma.period.findMany({
    where: { startDate: { lte: end }, endDate: { gte: start } },
    orderBy: { endDate: "asc" },
  });

  const members = await prisma.teamMember.findMany({ orderBy: { name: "asc" } });

  const empty: MonthlyReport = {
    monthKey,
    periodCount: 0,
    totals: { completed: 0, missed: 0, total: 0 },
    people: members
      .filter((m) => m.active)
      .map((m) => ({
        id: m.id,
        name: m.name,
        active: m.active,
        assigned: 0,
        completed: 0,
        missed: 0,
      })),
    stuck: [],
  };

  if (periods.length === 0) return empty;

  const periodOrder = new Map(periods.map((p, i) => [p.id, i]));
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

  const counts = new Map<string, { assigned: number; completed: number; missed: number }>();
  const bump = (id: string, done: boolean) => {
    const row = counts.get(id) ?? { assigned: 0, completed: 0, missed: 0 };
    row.assigned += 1;
    if (done) row.completed += 1;
    else row.missed += 1;
    counts.set(id, row);
  };

  let completed = 0;
  let missed = 0;

  for (const chain of chains.values()) {
    chain.sort(
      (a, b) => (periodOrder.get(a.periodId) ?? 0) - (periodOrder.get(b.periodId) ?? 0),
    );
    // A chain is complete if it was ticked off in any week this month; a done
    // task is never carried further, so that tick is always the final row.
    const isDone = chain.some((t) => t.status === "done");
    if (isDone) completed += 1;
    else missed += 1;

    // Owners can be edited over time — the most recent week is the truth.
    const latest = chain[chain.length - 1];
    if (latest.owners.length === 0) {
      bump(UNASSIGNED, isDone);
    } else {
      for (const owner of latest.owners) bump(owner.memberId, isDone);
    }
  }

  const people: PersonRow[] = members
    .map((member) => ({
      id: member.id,
      name: member.name,
      active: member.active,
      ...(counts.get(member.id) ?? { assigned: 0, completed: 0, missed: 0 }),
    }))
    // Keep inactive members out unless they actually did something this month.
    .filter((row) => row.active || row.assigned > 0);

  const unassigned = counts.get(UNASSIGNED);
  if (unassigned) {
    people.push({
      id: UNASSIGNED,
      name: "Team (unassigned)",
      active: true,
      ...unassigned,
    });
  }

  // Stuck items reflect current state, so they come from the most recent week
  // in this month rather than from every week in it.
  const lastPeriod = periods[periods.length - 1];
  const stuck: StuckRow[] = tasks
    .filter(
      (t) =>
        t.periodId === lastPeriod.id &&
        t.status === "open" &&
        t.carriedCount >= STUCK_THRESHOLD,
    )
    .sort((a, b) => b.carriedCount - a.carriedCount)
    .map((t) => ({
      id: t.id,
      text: t.text,
      carriedCount: t.carriedCount,
      owners: t.owners.map((o) => o.member.name),
    }));

  return {
    monthKey,
    periodCount: periods.length,
    totals: { completed, missed, total: completed + missed },
    people,
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
