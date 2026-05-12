-- CreateTable
CREATE TABLE "workspace_business_profiles" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "categories" TEXT[],
    "team_size" TEXT NOT NULL,
    "channels" TEXT[],
    "needs" TEXT[],
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_business_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_business_profiles_workspace_id_key" ON "workspace_business_profiles"("workspace_id");

-- CreateIndex
CREATE INDEX "workspace_business_profiles_workspace_id_idx" ON "workspace_business_profiles"("workspace_id");

-- AddForeignKey
ALTER TABLE "workspace_business_profiles" ADD CONSTRAINT "workspace_business_profiles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
