# PRD — Hii.Health Biomarker Co-Team Tracker

> **v2** — revised after requirements review. Key changes from v1: single-operator
> tool (no auth, no per-person login), tasks support **multiple owners or none**,
> and reporting is **calendar-month first** (weekly report dropped).

## 1. Overview

A small internal web app used by **one person** (the meeting note-taker) to track
what the Biomarker Co-Team agreed to in each weekly meeting, mark off what got
done, automatically carry forward anything unfinished into the next week, and pull
a **monthly summary** of what each person completed and what they missed.

**Primary use case:** during/after the weekly meeting, the operator enters the
agreed to-dos and checks off what was completed since last week. Between meetings
it's opened to see what's still outstanding.

**Not required:** multi-user login, per-person accounts, notifications, public
marketing pages, billing, multi-team support, mobile native apps.

## 2. Goals

- Replace manually re-typed to-do lists from meeting notes with a running,
  persistent record.
- Never lose an item — everything stays saved regardless of status.
- Make it obvious at a glance what's been carried over multiple weeks
  (early warning for stuck tasks).
- Produce a **monthly** summary per person and for the team without manual
  tallying — what each person did, and what each person missed.
- Run entirely on free-tier infrastructure (no paid hosting/DB required).

## 3. Users & Access

- **Single operator.** One person enters and maintains all data. There are no
  accounts, no roles, and no login screen.
- **Team members are labels, not users.** They exist only to be attached to
  tasks as owners. Seed list: **Thanveer, Prathapa, Janindu**. The list must be
  editable in-app (add new, mark inactive) — never hardcoded.
- **Access control:** none in v1. The app is reachable by anyone with the URL.
  Accepted tradeoff; a shared passcode gate can be added later without schema
  changes.

## 4. Tech Stack (all free-tier)

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router, TypeScript) | Deploys natively to Vercel, server + client in one project |
| Styling | Tailwind CSS | Fast to build with, no separate design system needed |
| Database | PostgreSQL via Supabase free tier (or Neon free tier — either works) | Free, hosted, no server to manage |
| ORM | Prisma | Type-safe schema + migrations, works cleanly with Next.js and Postgres |
| Auth | **None** | Single operator; no accounts needed |
| Hosting | Vercel (free Hobby tier) | Connects to GitHub for auto-deploys |
| Charts | Recharts | For the monthly per-person bar chart |

**Cost at this scale: $0/month.**

## 5. Data Model

```
TeamMember
- id (uuid, pk)
- name (text, required)
- active (boolean, default true)   // soft-remove, to preserve history
- created_at (timestamp)

Period
- id (uuid, pk)
- start_date (date, required)      // = previous period's end_date
- end_date (date, required)        // this period's meeting date
- created_at (timestamp)

Task
- id (uuid, pk)
- period_id (uuid, fk -> Period)
- text (text, required)
- status (enum: open | done, default open)
- notes (text, nullable)
- carried_count (integer, default 0)   // increments each time it rolls forward unfinished
- origin_task_id (uuid, fk -> Task, nullable, self-referencing)  // earliest ancestor; full lineage
- created_at (timestamp)
- completed_at (timestamp, nullable)   // set when status flips to done

TaskOwner                          // join table — a task has 0, 1, or many owners
- task_id (uuid, fk -> Task, cascade delete)
- member_id (uuid, fk -> TeamMember)
- pk (task_id, member_id)
```

**Owners.** A task can have **no owner** (a shared/team task everyone does
together), **one owner**, or **several owners**. This is why ownership lives in a
join table rather than a column on Task.

**Relationships:** One Period has many Tasks. A carried-forward Task links back to
its `origin_task_id` so the app can trace the same to-do across every week it
appeared in — this powers the "carried 3x" badge and the stuck-task list. Owner
assignments are copied along with the task when it carries forward.

## 6. Core Features

### 6.1 Current period view (home screen)
- Header shows the active (latest) period's date range, e.g. "Aug 12 → Aug 18".
- Task list per row: checkbox (toggle open/done), task text, owner chips
  (0-many; shows "Team" when unassigned), carried-count badge when
  `carried_count > 0` (e.g. "carried 2x").
- Inline add: text field + multi-select owner picker (leaving it empty is valid
  and means a team task) + "Add". One click to add, one click to check off.
- Edit and delete on each task.

### 6.2 Start next period
- Button: "Log next meeting."
- Prompts for the next meeting date. `start_date` auto-fills from the current
  latest period's `end_date` (not editable, keeps the timeline continuous).
- On confirm:
  - Creates the new Period row.
  - For every Task in the previous period still open, creates a new Task row in
    the new period with the same `text`, **the same owner set**, `origin_task_id`
    set to the earliest ancestor in the chain (or itself if first), and
    `carried_count = previous carried_count + 1`.
  - Tasks already done stay untouched in their original period — never copied.
- Preview before confirming: show how many open items will carry forward.

### 6.3 History
- List of all past periods by date range, most recent first.
- Clicking a past period shows its tasks, still editable for corrections.

### 6.4 Team member management
- Settings page: list members, add new, mark inactive (soft delete — never hard
  delete, past tasks reference them).
- Inactive members drop out of the owner picker for new tasks but still display
  correctly on their historical tasks.

### 6.5 Monthly report
Single view. Pick a calendar month (1st → last day, 30 or 31).

- **Team totals:** tasks completed, tasks still open, total, across every period
  overlapping that month.
- **Per-person breakdown:** for each member — assigned / completed / missed
  (still open). Shown as a table plus a simple Recharts bar chart.
  - A task with multiple owners counts toward each of its owners.
  - Tasks with no owner are grouped under a single **"Team (unassigned)"** row.
- **Stuck items:** any task currently open with `carried_count >= 3`, listed with
  text, owners, and how many weeks it's been carried.

## 7. Design / Theme

- Simple, minimal, **light** color scheme. Neutral background, one restrained
  accent color, plenty of whitespace.
- **No filler copy** — no explanatory paragraphs, taglines, marketing text, or
  onboarding blurbs. Labels and data only.
- Dense enough to scan a full week of tasks without scrolling where possible.
- Readable on a laptop and on a phone; not required to be pixel-perfect on mobile.

## 8. Non-Functional Requirements

- **Data integrity first:** nothing is ever silently deleted by carry-forward.
  Completed and historical tasks stay queryable forever.
- **Fast interactions:** checking a box or adding a task must not require a full
  page reload — server actions + optimistic UI.
- **No cost at current scale:** stay within Vercel Hobby + Supabase free tier.

## 9. Pages / Routes

- `/` — current period view (home)
- `/history` — list of past periods
- `/history/[periodId]` — single past period detail
- `/team` — team member management
- `/reports` — monthly summary

## 10. Build Order

1. Scaffold Next.js + TypeScript + Tailwind, connect to Postgres via Prisma,
   define schema from §5, run first migration, seed the three team members.
2. Current-period view: add / check off / edit / delete tasks with multi-owner
   support, against a seeded period, to verify DB writes end-to-end.
3. "Start next period" carry-forward logic — the core business logic. Test
   thoroughly across several fake weeks, including multi-owner and no-owner tasks.
4. History list + detail view.
5. Team member management.
6. Monthly report: totals, per-person breakdown, chart, stuck-items list.
7. Deploy to Vercel, connect the production database, verify env vars, full
   walkthrough on the live URL.

## 11. Out of Scope (v1)

- Any authentication or user accounts.
- Notifications/reminders (Slack/email).
- Weekly/per-period report view (monthly only).
- Role-based permissions.
- File attachments on tasks.
- Multi-team/multi-workspace support.

## 12. Resolved Decisions

- **Auth:** none. Single operator, no login. *(was §11 open question)*
- **Reporting cadence:** monthly only; the weekly summary view is dropped.
- **Owners:** 0-to-many per task, via join table.
- **Seed members:** Thanveer, Prathapa, Janindu — more addable in-app.
- **Historical prototype data (Aug 12-18):** start fresh; re-enter manually later
  if wanted.
