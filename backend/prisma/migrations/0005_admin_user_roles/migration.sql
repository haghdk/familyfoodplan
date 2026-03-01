-- Add role column and enum for admin users
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'VIEWER');

ALTER TABLE "AdminUser"
ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'ADMIN';
