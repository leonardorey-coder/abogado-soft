DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'activity_type'
      AND e.enumlabel = 'CONNECTION_STARTED'
  ) THEN
    ALTER TYPE activity_type ADD VALUE 'CONNECTION_STARTED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'activity_type'
      AND e.enumlabel = 'CONNECTION_ENDED'
  ) THEN
    ALTER TYPE activity_type ADD VALUE 'CONNECTION_ENDED';
  END IF;
END $$;
