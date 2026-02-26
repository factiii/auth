-- Drop existing OTP table and recreate with auto-increment id (1-to-many, single-use)
DROP TABLE IF EXISTS "OTP";

CREATE TABLE "OTP" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "OTP_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OTP_userId_idx" ON "OTP"("userId");

ALTER TABLE "OTP" ADD CONSTRAINT "OTP_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
