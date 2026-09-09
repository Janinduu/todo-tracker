/**
 * Restores a `data-export.json` dump into an empty database.
 *
 *   npx tsx prisma/restore.ts
 *
 * Preserves the original UUIDs, so carry-forward lineage (`origin_task_id`)
 * survives the move intact. Idempotent — re-running it changes nothing.
 *
 * Tasks are inserted with a null lineage pointer first and wired up in a second
 * pass, because `origin_task_id` is a self-referencing foreign key and an
 * ancestor may not exist yet when its descendant is inserted.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { prisma } from "../lib/prisma";

type Dump = {
  exportedAt: string;
  members: { id: string; name: string; active: boolean; createdAt: string }[];
  periods: { id: string; startDate: string; endDate: string; createdAt: string }[];
  tasks: {
    id: string;
    periodId: string;
    text: string;
    status: "open" | "done";
    priority: "low" | "medium" | "high";
    notes: string | null;
    carriedCount: number;
    originTaskId: string | null;
    createdAt: string;
    completedAt: string | null;
  }[];
  owners: { taskId: string; memberId: string }[];
};

async function main() {
  const dump: Dump = JSON.parse(readFileSync("data-export.json", "utf8"));
  console.log(`restoring dump from ${dump.exportedAt}`);

  for (const m of dump.members) {
    await prisma.teamMember.upsert({
      where: { id: m.id },
      update: { name: m.name, active: m.active },
      create: {
        id: m.id,
        name: m.name,
        active: m.active,
        createdAt: new Date(m.createdAt),
      },
    });
  }

  for (const p of dump.periods) {
    await prisma.period.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        startDate: new Date(p.startDate),
        endDate: new Date(p.endDate),
        createdAt: new Date(p.createdAt),
      },
    });
  }

  // Pass 1 — rows without their lineage pointer.
  for (const t of dump.tasks) {
    await prisma.task.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        periodId: t.periodId,
        text: t.text,
        status: t.status,
        priority: t.priority,
        notes: t.notes,
        carriedCount: t.carriedCount,
        originTaskId: null,
        createdAt: new Date(t.createdAt),
        completedAt: t.completedAt ? new Date(t.completedAt) : null,
      },
    });
  }

  // Pass 2 — now every ancestor exists, so the self-FK can be satisfied.
  for (const t of dump.tasks) {
    if (!t.originTaskId) continue;
    await prisma.task.update({
      where: { id: t.id },
      data: { originTaskId: t.originTaskId },
    });
  }

  for (const o of dump.owners) {
    await prisma.taskOwner.upsert({
      where: { taskId_memberId: { taskId: o.taskId, memberId: o.memberId } },
      update: {},
      create: { taskId: o.taskId, memberId: o.memberId },
    });
  }

  console.log("restored:", {
    members: await prisma.teamMember.count(),
    periods: await prisma.period.count(),
    tasks: await prisma.task.count(),
    owners: await prisma.taskOwner.count(),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
