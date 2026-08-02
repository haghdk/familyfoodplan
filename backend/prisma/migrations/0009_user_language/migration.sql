-- The interface language each user picked. Existing rows keep English, which is
-- what the app was before the language picker existed.

ALTER TABLE "UserSettings"
ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
