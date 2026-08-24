-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'medium';

-- CreateIndex
CREATE INDEX "tasks_period_id_priority_idx" ON "tasks"("period_id", "priority");
