CREATE TABLE "TurnAdminCredential" (
    "id" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TurnAdminCredential_pkey" PRIMARY KEY ("id")
);
