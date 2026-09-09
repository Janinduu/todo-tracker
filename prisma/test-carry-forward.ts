/**
 * Exercises the carry-forward engine and the monthly rollup against the real
 * database, then removes everything it created.
 *
 * Run: npm test
 *
 * Safe to run alongside live data. Every week it creates sits in March 2019 —
 * far from any real meeting — and it drives `carryForwardFrom` with an explicit
 * source period rather than "the latest week", so it can never pick up real
 * tasks. Cleanup is scoped to the period ids it created, and the run asserts
 * the live task count is unchanged at the end.
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { carryForwardFrom } from "../lib/period-logic";
import { getMonthlyReport, getPeriod } from "../lib/queries";
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

/** Only these are ever deleted at the end. */
const createdPeriodIds: string[] = [];

async function newestCreated() {
  return prisma.period.findFirstOrThrow({
    where: { id: { in: createdPeriodIds } },
    orderBy: { endDate: "desc" },
    include: {
      tasks: { include: { owners: true }, orderBy: { createdAt: "asc" } },
    },
  });
}

/** Carry forward from the newest week this test created — never the app's. */
async function carryForward(endDate: string) {
  const source = await newestCreated();
  const result = await carryForwardFrom(source.id, endDate);
  if (result.ok) {
    const created = await prisma.period.findFirstOrThrow({
      where: { startDate: source.endDate, endDate: parseDateInput(endDate) },
    });
    createdPeriodIds.push(created.id);
  }
  return result;
}

async function main() {
  const liveTasksBefore = await prisma.task.count();
  const livePeriodsBefore = await prisma.period.count();

  const [thanveer, prathapa, janindu] = await Promise.all([
    prisma.teamMember.findFirstOrThrow({ where: { name: "Thanveer" } }),
    prisma.teamMember.findFirstOrThrow({ where: { name: "Prathapa" } }),
    prisma.teamMember.findFirstOrThrow({ where: { name: "Janindu" } }),
  ]);

  try {
    // ---------------------------------------------------------------- week 1
    console.log("\nWeek 1 (Mar 1 → Mar 8): three tasks at three priorities");
    const week1 = await prisma.period.create({
      data: {
        startDate: parseDateInput("2019-03-01"),
        endDate: parseDateInput("2019-03-08"),
      },
    });
    createdPeriodIds.push(week1.id);

    // Deliberately created low → high, so correct ordering can't be an
    // accident of insertion order.
    const taskB = await prisma.task.create({
      data: {
        periodId: week1.id,
        text: "B — low, two owners",
        priority: "low",
        owners: {
          create: [{ memberId: prathapa.id }, { memberId: janindu.id }],
        },
      },
    });
    const taskC = await prisma.task.create({
      data: { periodId: week1.id, text: "C — medium, no owner", priority: "medium" },
    });
    const taskA = await prisma.task.create({
      data: {
        periodId: week1.id,
        text: "A — high, single owner",
        priority: "high",
        owners: { create: [{ memberId: thanveer.id }] },
      },
    });

    // A is finished this week and must never be copied forward again.
    await prisma.task.update({
      where: { id: taskA.id },
      data: { status: "done", completedAt: new Date() },
    });

    console.log("\nPriority ordering");
    const ordered = await getPeriod(week1.id);
    check(
      "high → medium → low, regardless of insertion order",
      ordered?.tasks.map((t) => t.priority),
      ["high", "medium", "low"],
    );

    // ---------------------------------------------------------------- week 2
    console.log("\nWeek 2 (Mar 8 → Mar 15): B and C should carry");
    check("carryForward ok", await carryForward("2019-03-15"), { ok: true });

    const week2 = await newestCreated();

    check("start date inherited from week 1 end", week2.startDate.toISOString(), "2019-03-08T00:00:00.000Z");
    check("carried task count", week2.tasks.length, 2);
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

    // Priority must survive the hop — an unfinished task doesn't get quieter.
    check("B keeps priority low", carriedB.priority, "low");
    check("C keeps priority medium", carriedC.priority, "medium");

    // The previous week must be untouched.
    const week1After = await prisma.task.findMany({ where: { periodId: week1.id } });
    check("week 1 still holds all three rows", week1After.length, 3);
    check(
      "week 1 A still done",
      week1After.find((t) => t.text.startsWith("A"))?.status,
      "done",
    );

    // ---------------------------------------------------------------- week 3
    console.log("\nWeek 3 (Mar 15 → Mar 22): B done, only C carries");
    await prisma.task.update({
      where: { id: carriedB.id },
      data: { status: "done", completedAt: new Date() },
    });
    check("carryForward ok", await carryForward("2019-03-22"), { ok: true });

    const week3 = await newestCreated();
    check("only C carries", week3.tasks.map((t) => t.text), ["C — medium, no owner"]);
    check("carriedCount now 2", week3.tasks[0].carriedCount, 2);
    check(
      "lineage still the earliest ancestor, not the parent",
      week3.tasks[0].originTaskId,
      taskC.id,
    );

    // ---------------------------------------------------------------- week 4
    console.log("\nWeek 4 (Mar 22 → Mar 29): C hits the stuck threshold");
    check("carryForward ok", await carryForward("2019-03-29"), { ok: true });

    const week4 = await newestCreated();
    check("carriedCount now 3", week4.tasks[0].carriedCount, 3);
    check("lineage unchanged across 3 hops", week4.tasks[0].originTaskId, taskC.id);
    check("priority still medium after 3 hops", week4.tasks[0].priority, "medium");

    // ------------------------------------------------------------ guardrails
    console.log("\nGuardrails");
    check("rejects a meeting date before the current one", await carryForward("2019-03-20"), {
      ok: false,
      error: "The next meeting must be after the current one.",
    });
    check("rejects a malformed date", await carryForward("not-a-date"), {
      ok: false,
      error: "Pick a valid meeting date.",
    });

    // ---------------------------------------------------------------- report
    console.log("\nMonthly rollup for March 2019");
    const report = await getMonthlyReport("2019-03");

    check("weeks counted", report.periodCount, 4);
    // Four weeks hold 3 + 2 + 1 + 1 = 7 rows, but only 3 real to-dos.
    check("totals deduped by lineage", report.totals, {
      completed: 2,
      missed: 1,
      total: 3,
    });

    check(
      "completed list holds A and B, once each",
      report.completed.map((r) => r.text).sort(),
      ["A — high, single owner", "B — low, two owners"],
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
      "Mar 1 → Mar 8",
    );

    check("missed list holds only C", report.missed.map((r) => r.text), ["C — medium, no owner"]);
    check("missed C shows no owners (a team task)", report.missed[0]?.owners, []);
    check("missed C reports its carry count", report.missed[0]?.carriedCount, 3);
    check(
      "missed C is filed under the latest week",
      report.missed[0]?.weekLabel,
      "Mar 22 → Mar 29",
    );

    check("one stuck item", report.stuck.length, 1);
    check("stuck item is C at 3x", report.stuck[0]?.carriedCount, 3);
    check("stuck item has no owners", report.stuck[0]?.owners, []);

    // ------------------------------------------------ historical-edit case
    // Correcting a past week can leave two rows of one chain marked done,
    // which carry-forward alone can never produce. The latest must win.
    console.log("\nHistorical edit: two done rows in one chain");
    const firstC = await prisma.task.findFirstOrThrow({
      where: { id: taskC.id },
    });
    await prisma.task.update({
      where: { id: firstC.id },
      data: { status: "done", completedAt: new Date() },
    });
    const lastC = week4.tasks[0];
    await prisma.task.update({
      where: { id: lastC.id },
      data: { status: "done", completedAt: new Date() },
    });

    const corrected = await getMonthlyReport("2019-03");
    const cRows = corrected.completed.filter((r) => r.text.startsWith("C"));
    check("chain still reported exactly once", cRows.length, 1);
    check(
      "latest completed row wins, not the earliest",
      cRows[0]?.weekLabel,
      "Mar 22 → Mar 29",
    );
    check("C no longer counted as missed", corrected.missed.length, 0);
    check("totals still cover 3 to-dos", corrected.totals.total, 3);

    // Put C back to open so the surrounding assertions keep their meaning.
    await prisma.task.update({
      where: { id: firstC.id },
      data: { status: "open", completedAt: null },
    });
    await prisma.task.update({
      where: { id: lastC.id },
      data: { status: "open", completedAt: null },
    });

    const emptyMonth = await getMonthlyReport("2019-01");
    check("empty month totals", emptyMonth.totals, { completed: 0, missed: 0, total: 0 });
    check("empty month has no stuck items", emptyMonth.stuck.length, 0);
  } finally {
    // Scoped to this run's periods only — live data is never in range.
    const taskIds = (
      await prisma.task.findMany({
        where: { periodId: { in: createdPeriodIds } },
        select: { id: true },
      })
    ).map((t) => t.id);

    await prisma.taskOwner.deleteMany({ where: { taskId: { in: taskIds } } });
    // Null the lineage pointers first so self-referencing FKs don't block the
    // delete regardless of the order rows come out in.
    await prisma.task.updateMany({
      where: { id: { in: taskIds } },
      data: { originTaskId: null },
    });
    await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
    await prisma.period.deleteMany({ where: { id: { in: createdPeriodIds } } });
    console.log("\ncleaned up test data");
  }

  console.log("\nLive data untouched");
  check("task count unchanged", await prisma.task.count(), liveTasksBefore);
  check("period count unchanged", await prisma.period.count(), livePeriodsBefore);

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
