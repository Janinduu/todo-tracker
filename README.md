# Hii.Health Biomarker Co-Team

Weekly to-do tracking for the Hii.Health Biomarker Co-Team. Spec: [PRD-hii-health-tracker.md](PRD-hii-health-tracker.md).

Next.js 16 (App Router) · Prisma 7 · Supabase Postgres · Tailwind 4.

## Setup

```bash
npm install
cp .env.example .env      # then fill in the database password
npx prisma migrate deploy
npx tsx prisma/seed.ts    # adds Thanveer, Prathapa, Janindu — safe to re-run
npm run dev
```

Both connection strings are required. `DATABASE_URL` is the pooled connection
(port 6543) used at runtime; `DIRECT_URL` is the session connection (port 5432)
used for migrations, which cannot run through the transaction pooler.

If the database password contains `@ : / ? # & +`, percent-encode it — those
characters are reserved in a URI and will otherwise break the connection string.

## Tests

```bash
npx tsx prisma/test-carry-forward.ts
```

Drives four fake weeks through the real carry-forward engine and the monthly
rollup, then deletes what it created. Safe to run alongside live data: its weeks
sit in March 2019, it carries forward from an explicit source period rather than
"the latest week", cleanup is scoped to the ids it created, and it asserts the
live row counts are unchanged at the end.

## How it works

Each week is a `Period`, and `start_date` is always inherited from the previous
week's `end_date`, so the timeline has no gaps.

"Log next meeting" creates the next period and copies every still-open task into
it as a **new row** — same text and owner set, `carried_count` incremented, and
`origin_task_id` pointing at the earliest ancestor in the chain. Completed tasks
are never copied and nothing is ever mutated or deleted, so every past week stays
exactly as it was.

That lineage pointer is what makes the monthly report honest: a to-do carried
across four weeks exists as four rows, and the report groups on
`origin_task_id ?? id` to count it once rather than four times.

Tasks can have zero owners (a shared team task, reported under
"Team (unassigned)"), one, or several — a task with three owners counts toward
all three.

Each task carries a priority (low / medium / high, defaulting to medium). The
current week sorts highest first, and priority travels with a task when it
carries forward.

Team members are soft-removed via `active`, never deleted, so their name keeps
rendering on tasks they owned in past weeks.

## Deploying

Push to GitHub, import the repo on Vercel, and set `DATABASE_URL` and
`DIRECT_URL` in the project's environment variables. `postinstall` runs
`prisma generate`; run `npx prisma migrate deploy` against production once.

There is no authentication — anyone with the URL can read and edit. That was a
deliberate v1 decision (PRD §3).
