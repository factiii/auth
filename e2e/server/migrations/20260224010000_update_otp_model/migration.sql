-- Drop existing OTP table
DROP TABLE IF EXISTS "OTP";

-- Recreate with new schema (userId as unique key, expiredAt instead of createdAt/disabled)
CREATE TABLE "OTP" (
    "code" INTEGER NOT NULL,
    "expiredAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL
);

CREATE UNIQUE INDEX "OTP_userId_key" ON "OTP"("userId");

ALTER TABLE "OTP" ADD CONSTRAINT "OTP_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
