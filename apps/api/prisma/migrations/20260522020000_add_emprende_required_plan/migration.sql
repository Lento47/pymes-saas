-- Keep feature flag plan requirements aligned with WorkspacePlan.
ALTER TYPE "RequiredPlan" ADD VALUE IF NOT EXISTS 'EMPRENDE';
