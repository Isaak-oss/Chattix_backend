-- One-time migration from "timestamp without time zone" to "timestamp with time zone".
-- Existing timestamp-without-time-zone values are interpreted as Asia/Almaty because that
-- was the database timezone before this change. Already-migrated timestamptz columns are
-- left untouched.

BEGIN;

SET LOCAL timezone = 'UTC';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'lastSeen'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'lastSeenAt'
  ) THEN
    ALTER TABLE "user" RENAME COLUMN "lastSeen" TO "lastSeenAt";
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'lastSeen'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'lastSeenAt'
  ) THEN
    UPDATE "user"
    SET "lastSeenAt" = "lastSeen" AT TIME ZONE 'Asia/Almaty'
    WHERE "lastSeen" IS NOT NULL;

    ALTER TABLE "user" DROP COLUMN "lastSeen";
  END IF;
END $$;

CREATE OR REPLACE FUNCTION migrate_column_to_timestamptz(table_name text, column_name text)
RETURNS void AS $$
DECLARE
  current_type text;
BEGIN
  SELECT data_type INTO current_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND information_schema.columns.table_name = migrate_column_to_timestamptz.table_name
    AND information_schema.columns.column_name = migrate_column_to_timestamptz.column_name;

  IF current_type = 'timestamp without time zone' THEN
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE %L',
      table_name,
      column_name,
      column_name,
      'Asia/Almaty'
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

SELECT migrate_column_to_timestamptz('chat_room', 'createdAt');
SELECT migrate_column_to_timestamptz('chat_room', 'updatedAt');
SELECT migrate_column_to_timestamptz('chat_room_read', 'lastReadAt');
SELECT migrate_column_to_timestamptz('chat_room_read', 'createdAt');
SELECT migrate_column_to_timestamptz('chat_room_read', 'updatedAt');
SELECT migrate_column_to_timestamptz('friend', 'createdAt');
SELECT migrate_column_to_timestamptz('message', 'createdAt');
SELECT migrate_column_to_timestamptz('message', 'updatedAt');
SELECT migrate_column_to_timestamptz('notification', 'readAt');
SELECT migrate_column_to_timestamptz('notification', 'createdAt');
SELECT migrate_column_to_timestamptz('post', 'createdAt');
SELECT migrate_column_to_timestamptz('post', 'updatedAt');
SELECT migrate_column_to_timestamptz('user', 'lastSeenAt');
SELECT migrate_column_to_timestamptz('user', 'createdAt');
SELECT migrate_column_to_timestamptz('user', 'updatedAt');

ALTER TABLE "user" ALTER COLUMN "lastSeenAt" SET DEFAULT CURRENT_TIMESTAMP;

DROP FUNCTION migrate_column_to_timestamptz(text, text);

COMMIT;
