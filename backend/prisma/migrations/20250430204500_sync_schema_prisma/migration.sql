-- Alinear enum activity_type y tabla firms con prisma/schema.prisma (invite_code solo en groups).

DO $$ BEGIN
  ALTER TYPE "activity_type" ADD VALUE 'CONNECTION_STARTED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "activity_type" ADD VALUE 'CONNECTION_ENDED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "activity_type" ADD VALUE 'USER_AVATAR_UPLOADED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "activity_type" ADD VALUE 'USER_AVATAR_UPDATED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "activity_type" ADD VALUE 'USER_AVATAR_REMOVED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "activity_type" ADD VALUE 'USER_COVER_UPLOADED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "activity_type" ADD VALUE 'USER_COVER_UPDATED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "activity_type" ADD VALUE 'USER_COVER_REMOVED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DROP INDEX IF EXISTS "firms_invite_code_idx";
DROP INDEX IF EXISTS "firms_invite_code_key";
ALTER TABLE "firms" DROP COLUMN IF EXISTS "invite_code";
