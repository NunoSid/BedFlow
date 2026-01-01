-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "targetBedId" TEXT,
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
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_targetBedId_fkey" FOREIGN KEY ("targetBedId") REFERENCES "Bed" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AuditLog" ("action", "afterState", "bedCode", "beforeState", "diff", "entity", "entityId", "floorName", "id", "reason", "timestamp", "userId") SELECT "action", "afterState", "bedCode", "beforeState", "diff", "entity", "entityId", "floorName", "id", "reason", "timestamp", "userId" FROM "AuditLog";
DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
