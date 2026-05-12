-- CreateTable
CREATE TABLE "plan_limit_overrides" (
    "id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_limit_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_limit_overrides_plan_resource_key" ON "plan_limit_overrides"("plan", "resource");
