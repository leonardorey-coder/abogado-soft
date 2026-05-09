-- Enum activity_type: valor usado en backups.routes; ya podía existir en BD por drift.
DO $$ BEGIN
  ALTER TYPE "activity_type" ADD VALUE 'BACKUP_DOWNLOADED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
