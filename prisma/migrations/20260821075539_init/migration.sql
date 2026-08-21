-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('open', 'done');

-- CreateTable
CREATE TABLE "team_members" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periods" (
    "id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "carried_count" INTEGER NOT NULL DEFAULT 0,
    "origin_task_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_owners" (
    "task_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,

    CONSTRAINT "task_owners_pkey" PRIMARY KEY ("task_id","member_id")
);

-- CreateIndex
CREATE INDEX "team_members_active_idx" ON "team_members"("active");

-- CreateIndex
CREATE INDEX "periods_end_date_idx" ON "periods"("end_date");

-- CreateIndex
CREATE UNIQUE INDEX "periods_start_date_end_date_key" ON "periods"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "tasks_period_id_idx" ON "tasks"("period_id");

-- CreateIndex
CREATE INDEX "tasks_origin_task_id_idx" ON "tasks"("origin_task_id");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_status_carried_count_idx" ON "tasks"("status", "carried_count");

-- CreateIndex
CREATE INDEX "task_owners_member_id_idx" ON "task_owners"("member_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_origin_task_id_fkey" FOREIGN KEY ("origin_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_owners" ADD CONSTRAINT "task_owners_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_owners" ADD CONSTRAINT "task_owners_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "team_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
