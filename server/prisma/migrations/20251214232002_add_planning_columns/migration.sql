-- CreateTable
CREATE TABLE "PlanningEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planDate" DATETIME NOT NULL,
    "bedId" TEXT,
    "bedCode" TEXT NOT NULL,
    "utenteName" TEXT,
    "utenteProcessNumber" TEXT,
    "surgeon" TEXT,
    "specialty" TEXT,
    "surgery" TEXT,
    "subsystem" TEXT,
    "observations" TEXT,
    "entryDate" DATETIME,
    "dischargeDate" DATETIME,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanningEntry_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlanningEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BedClinicalState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bedId" TEXT NOT NULL,
    "cvp_exists" BOOLEAN NOT NULL DEFAULT false,
    "therapy_exists" BOOLEAN NOT NULL DEFAULT false,
    "dib_exists" BOOLEAN NOT NULL DEFAULT false,
    "drains_exists" BOOLEAN NOT NULL DEFAULT false,
    "drains_location" TEXT,
    "drains_volume" TEXT,
    "drains_aspect" TEXT,
    "drains_obs" TEXT,
    "output_exists" BOOLEAN NOT NULL DEFAULT false,
    "output_count" TEXT,
    "output_consistency" TEXT,
    "output_obs" TEXT,
    "urination_exists" BOOLEAN NOT NULL DEFAULT false,
    "urination_volume" TEXT,
    "urination_obs" TEXT,
    "dressings_location" TEXT,
    "dressings_type" TEXT,
    "dressings_status" TEXT,
    "dressings_lastChange" DATETIME,
    "dressings_obs" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BedClinicalState_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_BedClinicalState" ("bedId", "drains_aspect", "drains_exists", "drains_location", "drains_obs", "drains_volume", "dressings_lastChange", "dressings_location", "dressings_obs", "dressings_status", "dressings_type", "id", "output_consistency", "output_count", "output_exists", "output_obs", "therapy_exists", "updatedAt", "urination_exists", "urination_obs", "urination_volume") SELECT "bedId", "drains_aspect", "drains_exists", "drains_location", "drains_obs", "drains_volume", "dressings_lastChange", "dressings_location", "dressings_obs", "dressings_status", "dressings_type", "id", "output_consistency", "output_count", "output_exists", "output_obs", "therapy_exists", "updatedAt", "urination_exists", "urination_obs", "urination_volume" FROM "BedClinicalState";
DROP TABLE "BedClinicalState";
ALTER TABLE "new_BedClinicalState" RENAME TO "BedClinicalState";
CREATE UNIQUE INDEX "BedClinicalState_bedId_key" ON "BedClinicalState"("bedId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "PlanningEntry_planDate_bedCode_key" ON "PlanningEntry"("planDate", "bedCode");
