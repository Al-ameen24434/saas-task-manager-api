-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "projects_isDeleted_idx" ON "projects"("isDeleted");

-- CreateIndex
CREATE INDEX "tasks_isDeleted_idx" ON "tasks"("isDeleted");
