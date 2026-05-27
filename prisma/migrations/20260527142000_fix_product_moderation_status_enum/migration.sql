DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ProductModerationStatus'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."ProductModerationStatus" AS ENUM ('APPROVED', 'UNDER_REVIEW', 'REMOVED');
  END IF;
END $$;

ALTER TABLE "public"."Product"
  ALTER COLUMN "moderationStatus" DROP DEFAULT,
  ALTER COLUMN "moderationStatus" TYPE "public"."ProductModerationStatus"
    USING "moderationStatus"::"public"."ProductModerationStatus",
  ALTER COLUMN "moderationStatus" SET DEFAULT 'APPROVED';
