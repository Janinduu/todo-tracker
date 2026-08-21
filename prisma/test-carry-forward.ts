/**
 * Exercises the carry-forward engine and the monthly rollup against the real
 * database, then removes everything it created.
 *
 * Run: npx tsx prisma/test-carry-forward.ts
 *
 * Refuses to run if any periods already exist, so it can never disturb real
 * meeting data.
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { createNextPeriod } from "../lib/period-logic";
import { getMonthlyReport } from "../lib/queries";
import { parseDateInput } from "../lib/dates";

let failures = 0;
let checks = 0;

function check(label: string, actual: unknown, expected: unknown) {
  checks += 1;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}\n         expected ${e}\n         actual   ${a}`);
  }
}

async function main() {
  const existingPeriods = await prisma.period.count();
  if (existingPeriods > 0) {
    console.error(
      `Refusing to run: ${existingPeriods} period(s) already exist. This test ` +
        `only runs against an empty timeline so it can't touch real data.`,
    );
    process.exit(1);
  }

  const [thanveer, prathapa, janindu] = await Promise.all([
    prisma.teamMember.findFirstOrThrow({ where: { name: "Thanveer" } }),
    prisma.teamMember.findFirstOrThrow({ where: { name: "Prathapa" } }),
    prisma.teamMember.findFirstOrThrow({ where: { name: "Janindu" } }),
  ]);

  try {
    // ---------------------------------------------------------------- week 1
    console.log("\nWeek 1 (Aug 1 → Aug 8): three tasks, one gets done");
    const week1 = await prisma.period.create({
      data: {
        startDate: parseDateInput("2026-08-01"),
        endDate: parseDateInput("2026-08-08"),
      },
    });

    const taskA = await prisma.task.create({
      data: {
        periodId: week1.id,
        text: "A — single owner",
        owners: { create: [{ memberId: thanveer.id }] },
      },
    });
    const taskB = await prisma.task.create({
      data: {
        periodId: week1.id,
        text: "B — two owners",
        owners: {
          create: [{ memberId: prathapa.id }, { memberId: janindu.id }],
        },
      },
    });
    const taskC = await prisma.task.create({
      data: { periodId: week1.id, text: "C — no owner" },
    });

    // A is finished this week and must never be copied forward again.
    await prisma.task.update({
      where: { id: taskA.id },
      data: { status: "done", completedAt: new Date() },
    });

    // ---------------------------------------------------------------- week 2
    console.log("\nWeek 2 (Aug 8 → Aug 15): B and C should carry");
    check("createNextPeriod ok", await createNextPeriod("2026-08-15"), { ok: true });

    const week2 = await prisma.period.findFirstOrThrow({
      orderBy: { endDate: "desc" },
      include: { tasks: { include: { owners: true }, orderBy: { createdAt: "asc" } } },
    });

    check("start date inherited from week 1 end", week2.startDate.toISOString(), "2026-08-08T00:00:00.000Z");
    check("carried task count", week2.tasks.length, 2);
    check("carried texts", week2.tasks.map((t) => t.text), ["B — two owners", "C — no owner"]);
    check("done task not copied", week2.tasks.some((t) => t.text.startsWith("A")), false);
    check("carriedCount incremented to 1", week2.tasks.map((t) => t.carriedCount), [1, 1]);

    const carriedB = week2.tasks.find((t) => t.text.startsWith("B"))!;
    const carriedC = week2.tasks.find((t) => t.text.startsWith("C"))!;

    check("B keeps both owners", carriedB.owners.length, 2);
    check(
      "B owner ids preserved",
      carriedB.owners.map((o) => o.memberId).sort(),
      [prathapa.id, janindu.id].sort(),
    );
    check("C stays unowned", carriedC.owners.length, 0);
    check("B lineage points at original", carriedB.originTaskId, taskB.id);
    check("C lineage points at original", carriedC.originTaskId, taskC.id);

    // The previous week must be untouched.
    const week1After = await prisma.task.findMany({ where: { periodId: week1.id } });
    check("week 1 still holds all three rows", week1After.length, 3);
    check(
      "week 1 A still done",
      week1After.find((t) => t.text.startsWith("A"))?.status,
      "done",
    );

    // ---------------------------------------------------------------- week 3
    console.log("\nWeek 3 (Aug 15 → Aug 22): B done, only C carries");
    await prisma.task.update({
      where: { id: carriedB.id },
      data: { status: "done", completedAt: new Date() },
    });
    check("createNextPeriod ok", await createNextPeriod("2026-08-22"), { ok: true });

    const week3 = await prisma.period.findFirstOrThrow({
      orderBy: { endDate: "desc" },
      include: { tasks: true },
    });
    check("only C carries", week3.tasks.map((t) => t.text), ["C — no owner"]);
    check("carriedCount now 2", week3.tasks[0].carriedCount, 2);
    check(
      "lineage still the earliest ancestor, not the parent",
      week3.tasks[0].originTaskId,
      taskC.id,
    );

    // ---------------------------------------------------------------- week 4
    console.log("\nWeek 4 (Aug 22 → Aug 29): C hits the stuck threshold");
    check("createNextPeriod ok", await createNextPeriod("2026-08-29"), { ok: true });

    const week4 = await prisma.period.findFirstOrThrow({
      orderBy: { endDate: "desc" },
      include: { tasks: true },
    });
    check("carriedCount now 3", week4.tasks[0].carriedCount, 3);
    check("lineage unchanged across 3 hops", week4.tasks[0].originTaskId, taskC.id);

    // ------------------------------------------------------------ guardrails
    console.log("\nGuardrails");
    check("rejects a meeting date before the current one", await createNextPeriod("2026-08-20"), {
      ok: false,
      error: "The next meeting must be after the current one.",
    });
    check("rejects a malformed date", await createNextPeriod("not-a-date"), {
      ok: false,
      error: "Pick a valid meeting date.",
    });

    // ---------------------------------------------------------------- report
    console.log("\nMonthly rollup for August 2026");
    const report = await getMonthlyReport("2026-08");

    check("weeks counted", report.periodCount, 4);
    // Four weeks hold 3 + 2 + 1 + 1 = 7 rows, but only 3 real to-dos.
    check("totals deduped by lineage", report.totals, {
      completed: 2,
      missed: 1,
      total: 3,
    });

    // The report lists the work itself, not per-person tallies.
    check(
      "completed list holds A and B, once each",
      report.completed.map((r) => r.text).sort(),
      ["A — single owner", "B — two owners"],
    );
    check(
      "A is credited to its owner",
      report.completed.find((r) => r.text.startsWith("A"))?.owners,
      ["Thanveer"],
    );
    check(
      "B is credited to both owners",
      report.completed.find((r) => r.text.startsWith("B"))?.owners,
      ["Janindu", "Prathapa"],
    );
    check(
      "A is filed under the week it was finished in",
      report.completed.find((r) => r.text.startsWith("A"))?.weekLabel,
      "Aug 1 → Aug 8",
    );

    check("missed list holds only C", report.missed.map((r) => r.text), ["C — no owner"]);
    check("missed C shows no owners (a team task)", report.missed[0]?.owners, []);
    check("missed C reports its carry count", report.missed[0]?.carriedCount, 3);
    check(
      "missed C is filed under the latest week",
      report.missed[0]?.weekLabel,
      "Aug 22 → Aug 29",
    );

    check("one stuck item", report.stuck.length, 1);
    check("stuck item is C at 3x", report.stuck[0]?.carriedCount, 3);
    check("stuck item has no owners", report.stuck[0]?.owners, []);

    // A month with no weeks must not throw.
    const emptyMonth = await getMonthlyReport("2026-01");
    check("empty month totals", emptyMonth.totals, { completed: 0, missed: 0, total: 0 });
    check("empty month has no stuck items", emptyMonth.stuck.length, 0);
  } finally {
    // Remove everything this test created, regardless of outcome.
    const periods = await prisma.period.findMany({ select: { id: true } });
    await prisma.taskOwner.deleteMany({
      where: { task: { periodId: { in: periods.map((p) => p.id) } } },
    });
    // Null the lineage pointers first so self-referencing FKs don't block the
    // delete regardless of the order rows come out in.
    await prisma.task.updateMany({ data: { originTaskId: null } });
    await prisma.task.deleteMany({});
    await prisma.period.deleteMany({});
    console.log("\ncleaned up test data");
  }

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
