-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Floor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Bed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedByUserId" TEXT,
    "lockReason" TEXT,
    "lockedAt" DATETIME,
    CONSTRAINT "Bed_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BedClinicalState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bedId" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "Utente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "processNumber" TEXT,
    "subsystem" TEXT
);

-- CreateTable
CREATE TABLE "Admission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bedId" TEXT NOT NULL,
    "utenteId" TEXT NOT NULL,
    "surgeon" TEXT NOT NULL,
    "surgery" TEXT NOT NULL,
    "entryDate" DATETIME NOT NULL,
    "dischargeDate" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Admission_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Admission_utenteId_fkey" FOREIGN KEY ("utenteId") REFERENCES "Utente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClinicalNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "admissionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "ClinicalNote_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "floorName" TEXT,
    "bedCode" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeState" TEXT,
    "afterState" TEXT,
    "diff" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Floor_name_key" ON "Floor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Bed_code_key" ON "Bed"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BedClinicalState_bedId_key" ON "BedClinicalState"("bedId");
