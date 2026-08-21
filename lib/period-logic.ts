import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/dates";

export type LogicResult = { ok: true } | { ok: false; error: string };

/**
 * Creates the next period and carries every still-open task into it (PRD §6.2).
 *
 * Kept separate from the server action so it can be exercised directly by
 * prisma/test-carry-forward.ts — `revalidatePath` needs a request context that
 * a plain script doesn't have.
 *
 * Invariants this must preserve:
 *   - the previous period's rows are never mutated or deleted
 *   - completed tasks are never copied forward
 *   - every row in a chain shares one `originTaskId` (the earliest ancestor)
 *   - `carriedCount` increments by exactly one per hop
 *   - the owner set travels with the task
 */
export async function createNextPeriod(endDateStr: string): Promise<LogicResult> {
  const latest = await prisma.period.findFirst({ orderBy: { endDate: "desc" } });
  if (!latest) {
    return { ok: false, error: "There's no current week to carry forward from." };
  }

  let endDate: Date;
  try {
    endDate = parseDateInput(endDateStr);
  } catch {
    return { ok: false, error: "Pick a valid meeting date." };
  }

  // Inherited, never user-supplied, so the timeline has no gaps.
  const startDate = latest.endDate;
  if (endDate <= startDate) {
    return { ok: false, error: "The next meeting must be after the current one." };
  }

  const clash = await prisma.period.findFirst({ where: { startDate, endDate } });
  if (clash) return { ok: false, error: "That week already exists." };

  await prisma.$transaction(async (tx) => {
    const period = await tx.period.create({ data: { startDate, endDate } });

    const carrying = await tx.task.findMany({
      where: { periodId: latest.id, status: "open" },
      include: { owners: true },
      orderBy: { createdAt: "asc" },
    });

    for (const task of carrying) {
      await tx.task.create({
        data: {
          periodId: period.id,
          text: task.text,
          notes: task.notes,
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
