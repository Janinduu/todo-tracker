# Build Specification — Hii.Health Biomarker Co-Team Tracker

**A complete, self-contained brief for rebuilding this application from scratch.**

Everything needed is in this document: the business context, every functional
requirement, the full data model, the exact algorithms, the design system with
real hex values, the deployment path, and the implementation traps that cost
time the first time round.

Read it top to bottom before writing code. The build order is §16.

| | |
|---|---|
| **Company** | Hii.Health |
| **Team** | Biomarker Co-Team |
| **Team members (seed)** | Thanveer, Prathapa, Janindu |
| **App name (header + browser tab)** | Hii.Health Biomarker Co-Team |
| **Repository** | https://github.com/Janinduu/todo-tracker |
| **Production** | https://todo-tracker-pi-flax.vercel.app |
| **Hosting** | Vercel (free Hobby tier), auto-deploy from `main` |
| **Database** | Supabase Postgres, free tier, region `ap-northeast-1` (Tokyo) |
| **Running cost** | $0 / month |
| **Authentication** | None — deliberate, see §3 |

---

## 1. Why this exists

The Biomarker Co-Team at Hii.Health meets once a week. Before this app, the
to-do list was re-typed by hand from meeting notes every week. Two things went
wrong constantly:

1. **Unfinished items silently vanished.** If someone forgot to re-type a task,
   it was gone. Nobody noticed.
2. **Nobody could answer "what did we drop last month?"** There was no record
   connecting one week's list to the next.

The app replaces that with a running, permanent record. In the manager's words:

> We need a cadence — what we discussed in the last meeting, take down everything
> we have done, or else if we have missed anything that will carry forward to
> next week. And each month I need a summary of what has been done and what has
> been missed.

That is the whole product. Three obligations follow from it, and every design
decision in this document serves one of them:

- **Nothing is ever lost.** Carry-forward creates new rows and never mutates or
  deletes old ones, so every past week stays exactly as it was recorded.
- **Stuck work becomes visible.** Each task counts how many weeks it has rolled
  over. Three or more surfaces it in a "Stuck" list to raise in the meeting.
- **The month adds up honestly.** A to-do carried across four weeks exists as
  four database rows but must be reported **once**, not four times.

---

## 2. Vocabulary

Use these terms consistently in code, UI and commits.

| Term | Meaning |
|---|---|
| **Period** (a "week") | The span between two meetings. `start_date` → `end_date`. |
| **Task** / to-do | One agreed item inside one period. |
| **Owner** | A team member attached to a task. A task has **0, 1, or many**. |
| **Team task** | A task with **zero** owners — work everyone does together. Displayed as `Team`. |
| **Carry forward** | Copying an unfinished task into the next period as a new row. |
| **Carried count** | How many times a task has rolled over. Drives the "carried 2x" badge. |
| **Lineage** | The chain of rows representing one logical to-do across several weeks. |
| **Stuck** | An open task with `carried_count >= 3`. |

---

## 3. Users and access

**This is a single-operator tool.** One person — the meeting note-taker — enters
and maintains all data. The user's exact words:

> No need for passwords or anything else. This will be used by only me. I will
> note down each task and enter manually. This is basically just to keep track
> of everything and make sure we don't miss anything along the way.

Consequences, all deliberate:

- **No authentication.** No login page, no accounts, no roles, no session
  handling. Do not add any.
- **Team members are labels, not users.** Thanveer, Prathapa and Janindu exist
  only to be attached to tasks as owners. They never log in and have no
  credentials. The member table holds a name and an active flag — nothing else.
- **Anyone with the URL can read and edit.** This is an accepted trade-off at
  this scale. A shared-passcode gate could be added later as middleware plus one
  environment variable, with no schema change.
- **The member list must be editable in the app.** Seed the three names, but
  never hardcode them in components — the team will change.

---

## 4. Functional requirements

### 4.1 Logging a week's tasks

The home screen (`/`) shows the **current period** — always the one with the
latest `end_date`.

- Header shows the date range, e.g. `Aug 18 → Aug 25`.
- Tasks are listed **highest priority first** (high → medium → low), oldest
  first within a level. Open tasks appear above completed ones.
- Each row has: a checkbox, a coloured priority stripe on the left edge, the
  task text, owner chips, a carried badge when applicable, and a priority chip
  on the right.
- **Add a task inline:** a text field, a priority dropdown, an Add button, and
  a separate labelled row of owner chips.
- **Edit** any task: change its text, its owners, and its priority.
- **Delete** any task.
- Ticking a checkbox must be **instant** — optimistic UI, no page reload. This
  is used live during a screen-shared meeting; latency is unacceptable.

**First run.** With an empty database there is no period to show, so display a
"Start the first week" form asking for both a start date and a meeting date.
Every period after that is created by carry-forward, which supplies the start
date automatically.

### 4.2 Carrying forward to the next week

A button labelled **"Log next meeting"** on the home screen.

1. Prompts for the next meeting date only.
2. The start date is **inherited** from the current period's `end_date` and is
   shown disabled — it is never user-editable. This is what keeps the timeline
   continuous with no gaps between weeks.
3. Before confirming, show a preview: *"3 open items will carry forward.
   Completed items stay in Aug 18 → Aug 25."*
4. On confirm, run the carry-forward algorithm (§6.1).

### 4.3 History

- `/history` — every period, newest first, each showing its date range and a
  done/open count. The most recent is badged `current`.
- `/history/[periodId]` — one period's tasks, using the same task list
  component and still editable, for corrections. Show a note explaining that
  edits here will change the reports.

### 4.4 Monthly summary

`/reports`. **Monthly only — there is no weekly report view.** The user was
explicit:

> Not weekly, monthly. I need a summary of what each person has done and what
> has been missed, for the month, starting from the first of the month up to
> the final date, whether it is 30 or 31.

Select a calendar month. The page reports **the work itself**, not per-person
scores. The user refined this after seeing a per-member table:

> What I need is all the work completed and missed separately. Mention if a task
> is missed, whose task it was. I don't need member-wise missed cases.

So: **no per-member breakdown table, and no chart.** Ownership appears on each
task row instead, so "who missed this?" is answered per item rather than as a
scoreboard against a person.

Four sections:

| Section | Contents | Order |
|---|---|---|
| **Totals** | Completed, Missed, Total — three stat tiles | — |
| **Completed** | Every task finished that month, each with its owners and the week it was finished in | Chronological |
| **Missed** | Every task still open, each with its owners, the week it currently sits in, and its carry count | Most-carried first |
| **Stuck** | The subset of missed items carried 3+ times | Most-carried first |

Counting rules are in §6.2 — they are the part most easily got wrong.

### 4.5 Team management

`/team`.

- List active members; add a new member by name.
- Rename a member.
- **Deactivate** a member — a soft remove. Never hard-delete: past tasks
  reference them and their name must keep rendering on those tasks.
- Inactive members are listed separately and drop out of the owner picker for
  new tasks. They remain selectable while editing a task they already own, so an
  existing assignment survives an edit.
- Re-adding an inactive member by the same name reactivates them rather than
  creating a duplicate. Name matching is case-insensitive.

### 4.6 Priority

Three levels. The user's specification:

> Less priority green, mid amber/orange, high red. And the This Week section —
> tasks need to be shown as highest priority ones first, mid next, and less at
> last.

- Set via a **labelled dropdown**, not a row of toggle chips. Chips were tried
  and rejected: sitting beside the owner-name chips they read as one
  undifferentiated strip.
- Options and chips spell out **"High priority" / "Medium priority" / "Low
  priority"** in full. A bare "High" beside a list of names does not obviously
  refer to priority.
- Default for a new task is **medium**, with the dropdown visible while adding
  so the level is a choice rather than a silent assumption.
- **Priority travels with a task when it carries forward.** An unfinished item
  does not become less important by rolling over.
- Editable on any existing task through the edit form.

---

## 5. Data model

Four tables. Complete Prisma schema — this is the actual production schema, use
it verbatim.

```prisma
generator client {
  provider = "prisma-client"
  output   = "../app/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum TaskStatus {
  open
  done
}

/// Declared low → high so Postgres orders the enum that way, which lets the
/// current-week query sort `priority: "desc"` to put high first.
enum TaskPriority {
  low
  medium
  high
}

/// A person who can own tasks. Never hard-deleted — `active` is a soft-remove
/// so historical tasks keep displaying the right name.
model TeamMember {
  id        String      @id @default(uuid()) @db.Uuid
  name      String
  active    Boolean     @default(true)
  createdAt DateTime    @default(now()) @map("created_at")
  tasks     TaskOwner[]

  @@index([active])
  @@map("team_members")
}

/// One week between meetings. start_date == previous period's end_date,
/// which keeps the timeline continuous with no gaps.
model Period {
  id        String   @id @default(uuid()) @db.Uuid
  startDate DateTime @map("start_date") @db.Date
  endDate   DateTime @map("end_date") @db.Date
  createdAt DateTime @default(now()) @map("created_at")
  tasks     Task[]

  @@unique([startDate, endDate])
  @@index([endDate])
  @@map("periods")
}

/// A to-do inside one period. When it carries forward, a NEW row is created in
/// the next period — this row is never mutated or deleted, so history is intact.
model Task {
  id           String       @id @default(uuid()) @db.Uuid
  periodId     String       @map("period_id") @db.Uuid
  text         String
  status       TaskStatus   @default(open)
  priority     TaskPriority @default(medium)
  notes        String?
  /// Increments on each carry-forward. Drives the "carried 2x" badge.
  carriedCount Int          @default(0) @map("carried_count")
  /// Earliest ancestor in the carry-forward chain (null on a first occurrence).
  originTaskId String?      @map("origin_task_id") @db.Uuid
  createdAt    DateTime     @default(now()) @map("created_at")
  completedAt  DateTime?    @map("completed_at")

  period      Period      @relation(fields: [periodId], references: [id], onDelete: Cascade)
  origin      Task?       @relation("TaskLineage", fields: [originTaskId], references: [id], onDelete: SetNull)
  descendants Task[]      @relation("TaskLineage")
  owners      TaskOwner[]

  @@index([periodId])
  @@index([periodId, priority])
  @@index([originTaskId])
  @@index([status])
  @@index([status, carriedCount])
  @@map("tasks")
}

/// Join table: a task has 0, 1, or many owners. Zero owners == a shared team
/// task, which is a valid and expected state.
model TaskOwner {
  taskId   String @map("task_id") @db.Uuid
  memberId String @map("member_id") @db.Uuid

  task   Task       @relation(fields: [taskId], references: [id], onDelete: Cascade)
  // Restrict, not Cascade: members are soft-removed via `active`. If something
  // ever attempts a hard delete, this fails loudly instead of silently
  // erasing ownership history.
  member TeamMember @relation(fields: [memberId], references: [id], onDelete: Restrict)

  @@id([taskId, memberId])
  @@index([memberId])
  @@map("task_owners")
}
```

### 5.1 Why ownership is a join table

A task may legitimately have **no owner** — the user's words:

> For each task, maybe there will be one or more owners, and there will be no
> owners because some tasks we all do after gathering.

Neither zero nor many fits a nullable `owner_id` column, and a comma-separated
string would make "everything Janindu owns" unqueryable. Hence `task_owners`.

### 5.2 Foreign-key behaviour

Each rule is deliberate; one is load-bearing for data safety.

| Relation | On delete | Reason |
|---|---|---|
| `tasks.period_id` | `CASCADE` | Deleting a week should take its tasks with it |
| `tasks.origin_task_id` | `SET NULL` | Deleting one week's row must not cascade through the whole lineage |
| `task_owners.task_id` | `CASCADE` | Ownership is meaningless without its task |
| `task_owners.member_id` | **`RESTRICT`** | Members are soft-removed. If code ever attempts a hard delete, this fails loudly instead of silently erasing ownership history |

### 5.3 Dates are UTC, always

Period dates are Postgres `DATE`, which Prisma returns pinned to UTC midnight.
**Every read and write must use UTC getters.** The operator is in Sri Lanka
(UTC+5:30); using local-time getters shifts meeting dates by a day.

Implement a `lib/dates.ts` with at minimum:

```ts
parseDateInput(value: string): Date   // "2026-08-21" -> Date at UTC midnight
toDateInput(date: Date): string       // Date -> "2026-08-21" for <input type="date">
formatDay(date: Date): string         // "Aug 21"
formatRange(start, end): string        // "Aug 12 → Aug 18", adds years if it crosses one
monthBounds(monthKey: string)          // "2026-08" -> { start: Aug 1, end: Aug 31 }
toMonthKey(date: Date): string         // Date -> "2026-08"
formatMonth(monthKey: string): string  // "2026-08" -> "August 2026"
todayUTC(): Date
addDays(date: Date, days: number): Date
```

`monthBounds` gets 28/29/30/31 right without a leap-year special case by using
`new Date(Date.UTC(year, month, 0))` — day 0 of the next month is the last day
of this one.

---

## 6. Core algorithms

These two are the heart of the application. Get them wrong and the app is
worse than a spreadsheet.

### 6.1 Carry-forward

Put this in `lib/period-logic.ts`, free of any React import so it can be tested
by a plain Node script.

```ts
/**
 * Creates the period following `sourcePeriodId` and carries every still-open
 * task into it.
 *
 * Takes the source period explicitly rather than resolving "the latest one"
 * itself, so the test suite can drive it against isolated weeks without
 * touching real data.
 */
export async function carryForwardFrom(
  sourcePeriodId: string,
  endDateStr: string,
): Promise<LogicResult> {
  const source = await prisma.period.findUnique({ where: { id: sourcePeriodId } });
  if (!source) return { ok: false, error: "There's no current week to carry forward from." };

  let endDate: Date;
  try { endDate = parseDateInput(endDateStr); }
  catch { return { ok: false, error: "Pick a valid meeting date." }; }

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
          priority: task.priority,          // travels with the task
          carriedCount: task.carriedCount + 1,
          originTaskId: task.originTaskId ?? task.id,   // <- see below
          owners: { create: task.owners.map((o) => ({ memberId: o.memberId })) },
        },
      });
    }
  });

  return { ok: true };
}

/** Carry forward from whichever week is currently the latest. Used by the app. */
export async function createNextPeriod(endDateStr: string): Promise<LogicResult> {
  const latest = await prisma.period.findFirst({ orderBy: { endDate: "desc" } });
  if (!latest) return { ok: false, error: "There's no current week to carry forward from." };
  return carryForwardFrom(latest.id, endDateStr);
}
```

**The critical line** is `originTaskId: task.originTaskId ?? task.id`.

It points at the **earliest ancestor**, not the immediate parent. A parent
pointer is the more common linked-list shape, but it would make every row in a
chain carry a different key and turn deduplication into a recursive query.
Because the whole chain shares one key, the monthly rollup is a single grouping
pass and the "carried 3x" badge is one integer read.

**Worked example.** Three weeks, one to-do:

```
Week 1 (Aug 1 → Aug 8)          Week 2 (Aug 8 → 15)        Week 3 (Aug 15 → 22)
  Website copy   done  c0         (not copied)
  Hydration      open  c0   ───>  Hydration  done  c1        (not copied)
  Re-label batch open  c0   ───>  Re-label   open  c1  ───>  Re-label open c2
                                                              origin ─┐
                                                                      │
  ◄───────────────── origin_task_id points all the way back ──────────┘
```

Three weeks, six rows, three logical to-dos.

**Invariants** — assert all of these in tests:

1. The source week's rows are never mutated or deleted.
2. Completed tasks are never copied forward.
3. Every row in a chain shares one `origin_task_id`.
4. `carried_count` increments by exactly one per hop.
5. The owner set travels with the task.
6. The priority travels with the task.

Wrap the whole thing in `prisma.$transaction` so a failure leaves no
half-created week.

### 6.2 Monthly report

`getMonthlyReport(monthKey: "YYYY-MM")` in `lib/queries.ts`.

```
1. Select every period that OVERLAPS the month, even partially:
      start_date <= monthEnd AND end_date >= monthStart

2. Load all tasks in those periods, with their owners.

3. Group tasks into chains keyed by `originTaskId ?? id`.

4. For each chain, sorted chronologically by period:
      - if ANY row is `done`  -> the chain is COMPLETED; report that row
      - otherwise             -> the chain is MISSED; report the LATEST row

5. Stuck = missed rows belonging to the month's final period
           with carried_count >= 3

6. Sort: completed chronologically; missed by carried_count descending
```

**Why grouping by lineage is mandatory.** In the §6.1 example, four weeks would
hold seven task rows but only three real to-dos. Counting rows would report a
single carried task as three separate misses against whoever owns it — actively
misleading in a summary whose whole purpose is accountability. The test locks
this in: *7 rows across 4 weeks → 3 reported items.*

Notes on the details:

- **If several rows in a chain are `done`, the latest one wins.** Carry-forward
  never copies a completed task, so this cannot arise from normal use — only
  from a historical correction, where a past week is ticked off after it has
  already carried forward. The latest done row is the most recent statement
  about the work, and an earlier one demonstrably wasn't final because the task
  kept being carried after it. Take the **whole reported line** from that one
  row — text, owners and week — so a completion in the report always
  corresponds to a real database row rather than being assembled from two.
  Implement as `filter(...).at(-1)`, **not** `find(...)`, which returns the
  earliest.
- Owners can be edited over time, so take them from the **most recent** row in
  the chain.
- Stuck items reflect *current* state, so they come from the month's last
  period, not from every period in it.
- A task with no owners reports as `Team`.
- A month containing no periods must return zeros, not throw.

### 6.3 Sorting the current week

```ts
const TASK_ORDER: Prisma.TaskOrderByWithRelationInput[] = [
  { priority: "desc" },
  { createdAt: "asc" },
];
```

`TaskPriority` is declared `low, medium, high` in the schema. Postgres orders an
enum by declaration order, so `desc` yields high → medium → low. **Reordering
the enum values would silently invert the entire home screen.**

---

## 7. Tech stack

Exact versions from the working build.

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js, App Router, Turbopack | `16.3.4` |
| UI runtime | React | `19.2.8` |
| Language | TypeScript | `^5` |
| Styling | Tailwind CSS + `@tailwindcss/postcss` | `^4` |
| ORM | Prisma | `7.9.1` |
| DB driver | `@prisma/adapter-pg` + `pg` | `7.9.1` / `^8.23` |
| Database | Supabase Postgres | — |
| Hosting | Vercel Hobby | — |
| Script runner | `tsx` | `^4.23` |
| Env loading | `dotenv` | `^17.4` |
| Lint | ESLint + `eslint-config-next` | `^9` / `16.3.4` |

**Deliberately absent:** no state-management library, no component library, no
chart library, no auth provider, no test framework. At this size each would be
more weight than help. All UI is hand-written; all interactivity is
`useOptimistic` and `useTransition`.

### 7.1 Prisma 7 differs from most tutorials

Two changes will break anyone working from Prisma 6 material:

**Prisma 7 ships no query engine.** `new PrismaClient()` with no arguments
throws — a driver adapter is mandatory:

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");

// Next hot-reloads modules in dev; a new pool per reload would exhaust
// Supabase's connection limit. Reuse one instance.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**`directUrl` is no longer a valid datasource key.** `prisma validate` ignores
unknown keys and passes silently; only `tsc` catches it. The two URLs are split
differently — see §9.

---

## 8. Project structure

```
app/
  page.tsx                    current week (home)
  layout.tsx                  shell, nav, metadata, noscript guard
  globals.css                 design tokens, .card, animations
  history/page.tsx
  history/[periodId]/page.tsx
  reports/page.tsx
  team/page.tsx
  _components/                underscore = not routable
    TaskList.tsx              the meeting-facing surface
    TeamManager.tsx
    PeriodForms.tsx           FirstPeriodForm + NextPeriodForm
    PriorityPicker.tsx        PrioritySelect + PriorityChip
    OwnerPicker.tsx
    NavLinks.tsx
    MonthPicker.tsx
    Reveal.tsx                scroll-reveal wrapper
  generated/prisma/           generated client — gitignored

lib/                          all logic, no React
  queries.ts                  every read
  actions.ts                  every write ("use server")
  period-logic.ts             the carry-forward engine
  dates.ts                    UTC-safe date handling
  priority.ts                 priority scale, labels, chip classes
  prisma.ts                   client singleton
  types.ts                    server → client view shapes

prisma/
  schema.prisma
  seed.ts                     idempotent member seed
  test-carry-forward.ts       the test suite
  migrations/

prisma.config.ts              CLI datasource (migrations)
```

**Architecture:** no API layer and no client-side data fetching. Pages are React
Server Components calling `lib/queries.ts` directly; mutations are server
actions in `lib/actions.ts` invoked straight from client components. After a
write, `revalidatePath("/", "layout")` re-renders the server component — that is
the only mechanism pushing new data to the screen.

Every route exports `export const dynamic = "force-dynamic"`. The app is opened
live during a meeting and must never serve a cached week.

**Client boundary:** Prisma rows never cross into client components. Server
components map them to plain shapes in `lib/types.ts` containing no `Date`
objects and no Prisma types:

```ts
export type MemberView = { id: string; name: string; active: boolean };

export type TaskView = {
  id: string;
  text: string;
  status: "open" | "done";
  priority: Priority;
  carriedCount: number;
  owners: { id: string; name: string }[];
};
```

### 8.1 Server actions

All in `lib/actions.ts` with `"use server"` at the top. Each returns
`{ ok: true } | { ok: false; error: string }` rather than throwing, so the UI
can show a message.

```
addTask(periodId, text, ownerIds[], priority)
setTaskStatus(taskId, done)          // sets/clears completedAt
updateTask(taskId, text, ownerIds[], priority)
deleteTask(taskId)
createFirstPeriod(startDateStr, endDateStr)
startNextPeriod(endDateStr)          // wraps createNextPeriod + revalidate
addMember(name)                      // reactivates an inactive match
setMemberActive(memberId, active)
renameMember(memberId, name)
```

Validate the priority value server-side (`isPriority(x) ? x : DEFAULT`) — it
crosses the client boundary and is a database enum on the other side.

`setTaskStatus` must clear `completedAt` to `null` when unticking, so the column
never claims a completion date for an open task.

---

## 9. Configuration

Two environment variables. Both required; different URLs to the same database.

| Variable | Port | Used by |
|---|---|---|
| `DATABASE_URL` | 6543 | App runtime. Transaction pooler with `?pgbouncer=true`. Serverless functions open many short-lived connections and would otherwise exhaust the free tier's limit. |
| `DIRECT_URL` | 5432 | Migrations only. Schema changes cannot run through the transaction pooler. |

Get both from Supabase → **Project Settings → Database → Connection string →
ORM → Prisma**.

Because Prisma 7 dropped `directUrl`, wire them like this:

```ts
// prisma.config.ts — CLI only (migrate, studio)
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "npx tsx prisma/seed.ts" },
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
```

`lib/prisma.ts` reads `DATABASE_URL` for the app runtime (§7.1).

### 9.1 Supabase project setup

When creating the project:

- Give it a real name, not the default.
- **Save the generated database password immediately** — it is shown once and is
  embedded in both connection strings.
- Region: closest to the team.
- **Uncheck "Enable Data API".** That option generates a public REST API over
  the tables for use with `supabase-js`. Prisma connects over the database
  protocol and does not use it. With no authentication in front of the app,
  leaving it on is pure extra surface area. The dashboard table editor still
  works. Reversible under Settings → API.
- Leave "Enable automatic RLS" unchecked — RLS is per-user access control, and
  there are no users.

### 9.2 package.json scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "postinstall": "prisma generate",
  "db:migrate": "prisma migrate dev",
  "db:deploy": "prisma migrate deploy",
  "db:seed": "tsx prisma/seed.ts",
  "test": "tsx prisma/test-carry-forward.ts"
}
```

`postinstall` is **required** for Vercel: the generated Prisma client is
gitignored, so builds fail without it.

### 9.3 Seed

Idempotent — safe to re-run.

```ts
const MEMBERS = ["Thanveer", "Prathapa", "Janindu"];

for (const name of MEMBERS) {
  const existing = await prisma.teamMember.findFirst({ where: { name } });
  if (existing) continue;
  await prisma.teamMember.create({ data: { name } });
}
```

Seed **members only** — no periods. The app handles the empty-timeline case with
its "Start the first week" form.

---

## 10. Design system

The user's brief:

> The theme is like, not a very complex one — a very simple, minimalistic, light
> colour one. Don't add unnecessary texts and paragraph-like details.

Later refined to a flat light green background with interaction animation.

**Light only.** No dark mode. The app is screen-shared in meetings and a
predictable appearance matters more than theme support.

**No filler copy.** No explanatory paragraphs, taglines, marketing text or
onboarding blurbs anywhere. Labels and data only.

### 10.1 Base tokens

Tailwind 4 is CSS-first — put these in a single `@theme` block in
`app/globals.css`. There is no `tailwind.config.js`.

```css
@theme {
  --color-canvas:      #e8eee6;   /* page background, flat sage green */
  --color-surface:     #fcfcfa;   /* cards */
  --color-ink:         #1c261f;   /* primary text */
  --color-muted:       #64705f;   /* labels */
  --color-faint:       #93a08d;   /* placeholders, metadata */
  --color-line:        #d5ded1;   /* borders */
  --color-accent:      #2b5f43;   /* buttons, active nav */
  --color-accent-soft: #dbe7dc;
  --color-warn:        #8a5320;
  --color-warn-soft:   #f4e6d4;
}
```

Cards are a `.card` class: `border-radius: .5rem`, 1px `--color-line` border,
`--color-surface` background, and a hairline shadow
`0 1px 2px rgb(28 38 31 / 0.04)`.

### 10.2 Semantic colours — one hue, one meaning

This is the part most likely to be got wrong. **Green, amber and red are
reserved for priority and used for nothing else.** Owners and the carry badge
need their own hues, because a task row can show all three at once and they were
originally indistinguishable.

```css
@theme {
  /* Priority */
  --color-prio-high:      #a32219;
  --color-prio-high-soft: #fadfdc;
  --color-prio-mid:       #8a5a15;
  --color-prio-mid-soft:  #f7e8ce;
  --color-prio-low:       #1f7a3a;
  --color-prio-low-soft:  #e6f3ea;

  /* Owners — blue everywhere a person appears */
  --color-owner:          #1f5b8f;
  --color-owner-soft:     #dbe7f2;

  /* Carry-forward badge — plum */
  --color-carried:        #7a3568;
  --color-carried-soft:   #f1dfea;
}
```

**Two findings worth preserving, both from measurement rather than taste:**

1. **Violet was the first choice for the carry badge and is wrong.** Against the
   owner blue it measures **ΔE 0.2 under deuteranopia** — effectively the same
   colour for a red-green colour-blind reader, and the two chips sit adjacent on
   the same row. Plum tested clear.

2. **The amber and green both failed accessibility checks initially.** Amber
   `#96631a` measured 4.24:1 against its chip background, under the 4.5:1 WCAG
   AA floor — darkened to `#8a5a15` (4.89:1). Green `#2f6d3f` was so desaturated
   it read grey as a small chip — re-chromed to `#1f7a3a`, which then measured
   4.48:1, so its chip background was lightened to `#e6f3ea` rather than
   darkening the text back.

All five chip colours now clear WCAG AA (4.5:1) against their own chip, the
canvas and a card.

**Red versus amber remains close under deuteranopia (ΔE 3.5).** This is inherent
to a traffic-light scale and cannot be tuned away. It is why every priority chip
spells out the level in words — colour is the fast scan, the word is the ground
truth.

### 10.3 Layout of a task row

Colour roles are separated by position as well as hue:

| Element | Position | Encoding |
|---|---|---|
| Priority stripe | 3px, left edge | Colour only, for scanning |
| Checkbox | left | Pops on tick |
| Task text | centre | Struck through when done |
| Owner chips | under the text | Blue |
| Carry badge | under the text | Plum, `carried 2x` |
| **Priority chip** | **right side** | Colour + full words |
| Edit / ✕ | right, on hover | ✕ rotates 90° |

The priority chip **must be on the right**. Placed before the owner chips it was
read as one of them.

### 10.4 Add-task form layout

Two labelled rows, divided:

```
[ Add a task ................ ]  Priority [Medium priority ▾]  [Add]
────────────────────────────────────────────────────────────────────
Owners  (Janindu) (Prathapa) (Thanveer)   unassigned = team task
```

The first attempt put owner chips, the hint and three priority chips all on one
line with nothing marking where one setting ended and the next began. It read as
noise. Labels and the divider are what fixed it.

### 10.5 Motion

The user asked for animation on click and on scroll. Keep it restrained.

| Trigger | Effect |
|---|---|
| Any button pressed | Scales to 96% |
| Checkbox ticked | Pops with slight overshoot (`cubic-bezier(.34,1.56,.64,1)`) |
| List rows appear | Stagger 45ms apart, capped at 8 rows |
| Section scrolls into view | Fades and lifts, via `IntersectionObserver`, fires once |
| Delete ✕ hovered | Rotates 90° |
| Nav link hovered | Lifts 1px |

**Two required safeguards.** Scroll-reveal works by starting elements at
`opacity: 0` and un-hiding them with JS:

- A `<noscript>` block in `layout.tsx` pins `.reveal` visible, or a browser with
  scripting off renders blank sections.
- `prefers-reduced-motion` disables the whole motion layer **in CSS, not JS** —
  doing it in JS means calling `setState` directly inside an effect, which the
  Next.js ESLint config rejects.

---

## 11. Local setup

```bash
npx create-next-app@latest <name> --ts --tailwind --eslint --app \
  --no-src-dir --use-npm --import-alias "@/*"

npm install @prisma/client @prisma/adapter-pg pg
npm install --save-dev prisma tsx dotenv @types/pg

npx prisma init --datasource-provider postgresql
# write schema.prisma, then:
npx prisma migrate dev --name init
npx tsx prisma/seed.ts
npm run dev
```

**Note:** `create-next-app` rejects a directory name containing capital letters
(npm package naming). If the target folder has any, scaffold into a lowercase
subfolder and move the contents up, then fix `name` in `package.json`.

`.gitignore` — the Next.js default contains `.env*`, which also swallows
`.env.example`. Add `!.env.example` after it.

---

## 12. Deployment

Vercel, connected to the GitHub repository. **Pushing to `main` deploys
automatically** — there is no manual deploy step for code changes.

1. Import the repo at vercel.com/new. Framework auto-detects as Next.js; leave
   the build settings at their defaults.
2. **Before the first deploy**, add both environment variables under Settings →
   Environment Variables, ticked for Production and Preview.
3. Deploy. Vercel runs `npm install` → `postinstall` → `prisma generate` →
   `next build`.
4. Set **Settings → Functions → Function Region** to match the database region
   (`hnd1` Tokyo for `ap-northeast-1`). The default is Washington DC, which adds
   a trans-Pacific round trip to every query.

**Environment variables are baked in at build time.** Adding or changing one
does **not** affect a deployment that is already running — you must redeploy
(Deployments → latest → ⋯ → Redeploy).

**Migrations:** local and production point at the same Supabase project, so a
migration applied locally is already live. There is no separate production
migration step. Review the SQL before applying:
`npx prisma migrate dev --name x --create-only`, read it, then apply.

**Debugging a failed deployment.** A green build says nothing about environment
variables — Next never touches the database module at build time, only on
request. Check the **runtime logs**, not the build logs.

---

## 13. Implementation traps

Every one of these cost real time on the first build.

| Trap | Symptom | Fix |
|---|---|---|
| Prisma 7 needs a driver adapter | `new PrismaClient()` throws | Install `@prisma/adapter-pg` + `pg`, pass `adapter` |
| `directUrl` is not a valid key | `prisma validate` passes, `tsc` errors | Put the direct URL in `prisma.config.ts`'s `datasource.url` |
| Password with reserved characters | Auth fails, SASL error | Percent-encode: `+`→`%2B`, `?`→`%3F`, `@`→`%40`, `#`→`%23` |
| Quotes in Vercel env vars | 500 at runtime | Paste the value **without** surrounding quotes — Vercel stores it literally |
| Missing env vars | Build green, page 500s | Runtime-only failure; check runtime logs |
| Generated client gitignored | Vercel build fails | `"postinstall": "prisma generate"` |
| `.env*` in `.gitignore` | `.env.example` never committed | Add `!.env.example` |
| Enum order | Home screen sorted backwards | `TaskPriority` must be declared `low, medium, high` |
| Local-time date getters | Meeting dates off by one day | Use UTC getters throughout |
| `setState` directly in an effect | ESLint error in `Reveal` | Handle reduced-motion in CSS instead |
| Preview URLs need login | `todo-tracker-git-main-…` returns nothing | Only the production alias is public |

---

## 14. Testing

One suite, `prisma/test-carry-forward.ts`, run with `npm test`. It runs against
the **real database** rather than a mock — the invariants being protected are
database behaviours, and a mocked client would assert nothing about them.

**It must be safe to run alongside live data.** The original version refused to
run whenever any period existed, which meant it could never run again once the
app held real data — exactly when it became most valuable. The working approach:

- Every period it creates sits in **March 2019**, far from any real meeting.
- It drives `carryForwardFrom` with an **explicit source period**, never "the
  latest week", so it cannot pick up real tasks. This is the reason the function
  is split in two.
- Cleanup is scoped to the period ids it created, in a `finally` block.
- It asserts the **live row counts are unchanged** at the end.

**Required coverage (42 assertions in the working build):**

| Area | Asserts |
|---|---|
| Ordering | High → medium → low regardless of insertion order. Insert the rows low-first so a pass cannot be accidental. |
| Carry-forward | Correct rows copied; done tasks never copied; source week untouched; `carried_count` +1 per hop |
| Lineage | `origin_task_id` still points at the earliest ancestor after three hops |
| Owners | Multi-owner sets preserved; unowned tasks stay unowned |
| Priority | Survives three carry-forward hops |
| Guardrails | Rejects an earlier meeting date; rejects a malformed date |
| Report | 7 rows across 4 weeks → 3 reported items; correct owner attribution; correct week labels; stuck detection; empty month returns zeros |
| Historical edit | With both an ancestor and a later copy marked `done`, the chain is still reported **once** and takes the **latest** completed row's week |
| Safety | Live task and period counts unchanged |

---

## 15. Out of scope

Explicitly **not** wanted. Do not build these:

- Any authentication, login page, or user accounts.
- A weekly or per-period report view — monthly only.
- A per-member breakdown table or any chart in the reports.
- Role-based permissions.
- Notifications or reminders (Slack, email).
- File attachments on tasks.
- Multi-team or multi-workspace support.
- Dark mode.
- Public marketing pages, billing, mobile native apps.

---

## 16. Build order

Follow this sequence. Each step is verifiable before moving on.

1. **Scaffold** — Next.js + TypeScript + Tailwind. Install Prisma 7, the pg
   adapter, tsx and dotenv. Create the Supabase project (§9.1).
2. **Schema** — write `prisma/schema.prisma` from §5, run the first migration,
   seed the three members. Verify the tables exist.
3. **Current week view** — the task list with add, tick, edit, delete and
   multi-owner support, against a manually created period. Verifies database
   writes end to end.
4. **Carry-forward** — §6.1. This is the core business logic; write the test
   suite alongside it and get all invariants passing before continuing.
5. **History** — list and detail views, reusing the task list component.
6. **Team management** — add, rename, soft-deactivate.
7. **Monthly report** — §6.2. Totals, completed list, missed list, stuck list.
8. **Priority** — enum, sorting, dropdown, chips, stripes (§4.6, §6.3).
9. **Theme and motion** — §10. Do this last so styling doesn't slow the logic.
10. **Deploy** — push to GitHub, import on Vercel, set both env variables,
    redeploy, set the function region, walk through the live URL.

**Where to start reading the existing implementation:** `lib/period-logic.ts`
first — 83 lines, and the whole app's behaviour follows from it. Then
`getMonthlyReport` in `lib/queries.ts` to see how lineage grouping is consumed.
Run `npm test` to watch the invariants being checked.

---

## 17. Acceptance checklist

The build is complete when all of these are true.

- [ ] Adding a task with two owners, one owner, and no owners all work; the last shows as `Team`.
- [ ] The current week lists high priority first, then medium, then low.
- [ ] Ticking a checkbox updates instantly with no page reload.
- [ ] "Log next meeting" inherits the start date, shows a carry-forward preview, and refuses a date on or before the current meeting.
- [ ] After carry-forward: open tasks appear in the new week with `carried 1x`; completed tasks stay behind and are not copied.
- [ ] A task carried three times shows `carried 3x` and appears in the Stuck list.
- [ ] Priority and owners survive a carry-forward unchanged.
- [ ] The monthly report lists a task carried across several weeks **once**.
- [ ] Missed items name their owners; unowned ones show `Team`.
- [ ] Deactivating a member removes them from the owner picker but their name still renders on past tasks.
- [ ] Every past week remains exactly as it was after any number of carry-forwards.
- [ ] The browser tab reads "Hii.Health Biomarker Co-Team".
- [ ] `npm run build`, `npm run lint` and `npm test` all pass.
- [ ] The production URL serves the app with no login.
