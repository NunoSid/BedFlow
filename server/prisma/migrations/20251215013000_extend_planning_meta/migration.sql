-- Add optional demographic and allergy metadata to planning entries
ALTER TABLE "PlanningEntry" ADD COLUMN "ageYears" INTEGER;
ALTER TABLE "PlanningEntry" ADD COLUMN "sex" TEXT;
ALTER TABLE "PlanningEntry" ADD COLUMN "allergies" TEXT;
