"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/dates";
import { createNextPeriod } from "@/lib/period-logic";

export type ActionResult = { ok: true } | { ok: false; error: string };

const ok: ActionResult = { ok: true };
const fail = (error: string): ActionResult => ({ ok: false, error });

/** This app is small enough that a blanket revalidate is cheaper than
 *  reasoning about which of the four pages a given mutation touched. */
function revalidateAll() {
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ tasks */

export async function addTask(
  periodId: string,
  text: string,
  ownerIds: string[],
): Promise<ActionResult> {
  const trimmed = text.trim();
  if (!trimmed) return fail("Task can't be empty.");

  const period = await prisma.period.findUnique({ where: { id: periodId } });
  if (!period) return fail("That week no longer exists.");

  await prisma.task.create({
    data: {
      periodId,
      text: trimmed,
      owners: { create: dedupe(ownerIds).map((memberId) => ({ memberId })) },
    },
  });

  revalidateAll();
  return ok;
}

export async function setTaskStatus(
  taskId: string,
  done: boolean,
): Promise<ActionResult> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return fail("That task no longer exists.");

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: done ? "done" : "open",
      // Cleared on un-check so completedAt never claims a date for an open task.
      completedAt: done ? new Date() : null,
    },
  });

  revalidateAll();
  return ok;
}

export async function updateTask(
  taskId: string,
  text: string,
  ownerIds: string[],
): Promise<ActionResult> {
  const trimmed = text.trim();
  if (!trimmed) return fail("Task can't be empty.");

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return fail("That task no longer exists.");

  const nextOwners = dedupe(ownerIds);

  await prisma.$transaction([
    prisma.task.update({ where: { id: taskId }, data: { text: trimmed } }),
    prisma.taskOwner.deleteMany({ where: { taskId } }),
    prisma.taskOwner.createMany({
      data: nextOwners.map((memberId) => ({ taskId, memberId })),
    }),
  ]);

  revalidateAll();
  return ok;
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return ok; // already gone; nothing to report

  // Descendants keep existing — onDelete: SetNull on the lineage relation
  // means deleting one week's row never cascades into other weeks.
  await prisma.task.delete({ where: { id: taskId } });

  revalidateAll();
  return ok;
}

/* ---------------------------------------------------------------- periods */

/** First-ever period. Both dates come from the user since there's no
 *  predecessor to inherit a start date from. */
export async function createFirstPeriod(
  startDateStr: string,
  endDateStr: string,
): Promise<ActionResult> {
  const existing = await prisma.period.count();
  if (existing > 0) return fail("A week already exists.");

  let startDate: Date;
  let endDate: Date;
  try {
    startDate = parseDateInput(startDateStr);
    endDate = parseDateInput(endDateStr);
  } catch {
    return fail("Pick valid dates.");
  }

  if (endDate <= startDate) return fail("Meeting date must be after the start date.");

  await prisma.period.create({ data: { startDate, endDate } });
  revalidateAll();
  return ok;
}

/** Carry-forward (PRD §6.2). The logic lives in lib/period-logic.ts so it can
 *  be tested outside a request context; this only adds cache invalidation. */
export async function startNextPeriod(
  endDateStr: string,
): Promise<ActionResult> {
  const result = await createNextPeriod(endDateStr);
  if (result.ok) revalidateAll();
  return result;
}

/* ---------------------------------------------------------------- members */

export async function addMember(name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Name can't be empty.");

  const existing = await prisma.teamMember.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
  });
  if (existing) {
    if (!existing.active) {
      await prisma.teamMember.update({
        where: { id: existing.id },
        data: { active: true },
      });
      revalidateAll();
      return ok;
    }
    return fail(`${trimmed} is already on the team.`);
  }

  await prisma.teamMember.create({ data: { name: trimmed } });
  revalidateAll();
  return ok;
}

/** Soft-remove only. Members are never hard-deleted, so tasks they own in past
 *  weeks keep showing their name. */
export async function setMemberActive(
  memberId: string,
  active: boolean,
): Promise<ActionResult> {
  const member = await prisma.teamMember.findUnique({ where: { id: memberId } });
  if (!member) return fail("That person no longer exists.");

  await prisma.teamMember.update({ where: { id: memberId }, data: { active } });
  revalidateAll();
  return ok;
}

export async function renameMember(
  memberId: string,
  name: string,
): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Name can't be empty.");

  const member = await prisma.teamMember.findUnique({ where: { id: memberId } });
  if (!member) return fail("That person no longer exists.");

  await prisma.teamMember.update({
    where: { id: memberId },
    data: { name: trimmed },
  });
  revalidateAll();
  return ok;
}

function dedupe(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}
