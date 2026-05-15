-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "goal" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "timelineDays" INTEGER NOT NULL,
    "dailyHours" REAL NOT NULL,
    "wakeTime" TEXT NOT NULL,
    "sleepTime" TEXT NOT NULL,
    "currentLevel" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "telegramChatId" TEXT,
    "blockedTimes" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "currentLevel", "dailyHours", "goal", "id", "sleepTime", "telegramChatId", "timelineDays", "timezone", "wakeTime", "whyItMatters") SELECT "createdAt", "currentLevel", "dailyHours", "goal", "id", "sleepTime", "telegramChatId", "timelineDays", "timezone", "wakeTime", "whyItMatters" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
