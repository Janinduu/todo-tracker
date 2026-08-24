import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/dates";

export type LogicResult = { ok: true } | { ok: false; error: string };

/**
 * Creates the period following `sourcePeriodId` and carries every still-open
 * task into it (PRD §6.2).
 *
 * Takes the source period explicitly rather than resolving "the latest one"
 * itself, so a test can drive it against its own isolated weeks without
 * touching real meeting data.
 *
 * Invariants this must preserve:
 *   - the source period's rows are never mutated or deleted
 *   - completed tasks are never copied forward
 *   - every row in a chain shares one `originTaskId` (the earliest ancestor)
 *   - `carriedCount` increments by exactly one per hop
 *   - the owner set and the priority travel with the task
 */
export async function carryForwardFrom(
  sourcePeriodId: string,
  endDateStr: string,
): Promise<LogicResult> {
  const source = await prisma.period.findUnique({ where: { id: sourcePeriodId } });
  if (!source) {
    return { ok: false, error: "There's no current week to carry forward from." };
  }

  let endDate: Date;
  try {
    endDate = parseDateInput(endDateStr);
  } catch {
    return { ok: false, error: "Pick a valid meeting date." };
  }

  // Inherited, never user-supplied, so the timeline has no gaps.
  const startDate = source.endDate;
  if (endDate <= startDate) {
    return { ok: false, error: "The next meeting must be after the current one." };
  }

  const clash = await prisma.period.findFirst({ where: { startDate, endDate } });
  if (clash) return { ok: false, error: "That week already exists." };

  await prisma.$transaction(async (tx) => {
    const period = await tx.period.create({ data: { startDate, endDate } });

    const carrying = await tx.task.findMany({
      where: { periodId: source.id, status: "open" },
      include: { owners: true },
      orderBy: { createdAt: "asc" },
    });

    for (const task of carrying) {
      await tx.task.create({
        data: {
          periodId: period.id,
          text: task.text,
          notes: task.notes,
          // An unfinished task doesn't become less important by rolling over.
          priority: task.priority,
          carriedCount: task.carriedCount + 1,
          // The earliest ancestor, not the immediate parent — one lineage key
          // for the whole chain is what lets reports dedupe on it.
          originTaskId: task.originTaskId ?? task.id,
          owners: { create: task.owners.map((o) => ({ memberId: o.memberId })) },
        },
      });
    }
  });

  return { ok: true };
}

/** Carry forward from whichever week is currently the latest. */
export async function createNextPeriod(endDateStr: string): Promise<LogicResult> {
  const latest = await prisma.period.findFirst({ orderBy: { endDate: "desc" } });
  if (!latest) {
    return { ok: false, error: "There's no current week to carry forward from." };
  }
  return carryForwardFrom(latest.id, endDateStr);
}
