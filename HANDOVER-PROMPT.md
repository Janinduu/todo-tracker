# Handover prompt

Send this together with `BUILD-SPEC.md`. Copy everything between the rules.

---

I'm handing you a complete build specification, `BUILD-SPEC.md`, for an internal
web app: a weekly meeting to-do tracker for the Biomarker Co-Team at Hii.Health.
Please build it.

**Read the whole spec before writing any code.** It is self-contained — business
context, full database schema, both core algorithms with worked examples, the
design system with exact hex values, deployment steps, and a list of
implementation traps that cost time on the first build. Section 16 gives the
build order; section 17 is the acceptance checklist you should finish against.

## How I want you to work

**Follow the spec rather than improving on it.** Where it explains *why* a
decision was made — the carry-forward lineage pointer, lineage-grouped report
counts, reserved colour roles, the enum declaration order — those are load-
bearing and were arrived at by testing. If you think something is wrong, say so
and explain why, but don't silently change it.

**Section 15 lists what is deliberately out of scope.** No authentication, no
weekly report, no per-member score table, no charts, no dark mode. Please don't
add them.

**Stop and ask me rather than guessing.** Specifically:

- Anything needing an account, credential, key or URL that I have to give you
  (full list below) — ask, don't invent placeholder values and carry on.
- Anything destructive or irreversible: deleting data, resetting a database,
  force-pushing, changing production settings.
- Any point where the spec is ambiguous or contradicts itself.

**Tell me when you reach these checkpoints**, so I can verify before you build
on top of them:

1. Project scaffolded, schema migrated, three team members seeded.
2. Carry-forward engine working with its test suite passing.
3. All screens built and running locally — before we deploy.
4. Deployed and live.

## What you will need from me

Please **ask for these when you reach the step that needs them**, and tell me
exactly what you need and where to find it. Don't block at the start waiting for
all of it — most of the build works before any of it is required.

**Database — Supabase (free tier)**

- Whether I should create the Supabase project or you should walk me through it.
- Two connection strings from Project Settings → Database → Connection string →
  ORM → Prisma:
  - `DATABASE_URL` — transaction pooler, port **6543**, with `?pgbouncer=true`
  - `DIRECT_URL` — session pooler, port **5432**
- The database password is embedded in both. If it contains `@ : / ? # & +`
  those characters must be percent-encoded or the connection string won't parse.
  Flag this to me rather than debugging a mysterious auth failure.
- Confirm with me that the Supabase **Data API is disabled** — the spec explains
  why (§9.1).

**Hosting — Vercel (free Hobby tier)**

- Whether I import the GitHub repo into Vercel, or you do.
- I have to set the two environment variables in the Vercel dashboard myself —
  tell me when, and give me the exact values to paste. Note that they must be
  pasted **without surrounding quotes**.
- Remind me that environment variables are baked in at build time, so after
  adding them the deployment has to be **redeployed** — a green build with
  missing variables still 500s at runtime.
- Tell me which function region to set, so it matches the database region.

**Source control — GitHub**

- Confirm with me whether to use an existing repository or create a new one, and
  who is pushing.

**Nothing else.** To be clear, this app uses **no third-party APIs and no API
keys**. Prisma is just an ORM — there is no Prisma account or token involved.
There is no auth provider, no email service, no analytics, no payment provider.
The only external service is the Postgres database. If you find yourself needing
a key for anything else, something has gone off-spec — ask me first.

## When you're done

Walk me through the live URL against the section 17 acceptance checklist, and
tell me plainly which items pass and which don't. Also flag:

- Anything in the spec you had to interpret, and how you read it.
- Anything you couldn't do, and why.
- Any dependency versions you had to change from those in section 7, and what
  broke that forced it.

---
