-- One-time migration from "timestamp without time zone" to "timestamp with time zone".
-- Existing values are interpreted as Asia/Almaty because that is the current database timezone.
-- Run this before relying on TypeORM synchronize for these column type changes.

BEGIN;

SET LOCAL timezone = 'UTC';

ALTER TABLE "chat_room"
  ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE 'Asia/Almaty',
  ALTER COLUMN "updatedAt" TYPE timestamptz USING "updatedAt" AT TIME ZONE 'Asia/Almaty';

ALTER TABLE "chat_room_read"
  ALTER COLUMN "lastReadAt" TYPE timestamptz USING "lastReadAt" AT TIME ZONE 'Asia/Almaty',
  ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE 'Asia/Almaty',
  ALTER COLUMN "updatedAt" TYPE timestamptz USING "updatedAt" AT TIME ZONE 'Asia/Almaty';

ALTER TABLE "friend"
  ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE 'Asia/Almaty';

ALTER TABLE "message"
  ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE 'Asia/Almaty',
  ALTER COLUMN "updatedAt" TYPE timestamptz USING "updatedAt" AT TIME ZONE 'Asia/Almaty';

ALTER TABLE "notification"
  ALTER COLUMN "readAt" TYPE timestamptz USING "readAt" AT TIME ZONE 'Asia/Almaty',
  ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE 'Asia/Almaty';

ALTER TABLE "post"
  ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE 'Asia/Almaty',
  ALTER COLUMN "updatedAt" TYPE timestamptz USING "updatedAt" AT TIME ZONE 'Asia/Almaty';

ALTER TABLE "user"
  ALTER COLUMN "lastSeen" TYPE timestamptz USING "lastSeen" AT TIME ZONE 'Asia/Almaty',
  ALTER COLUMN "lastSeen" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE 'Asia/Almaty',
  ALTER COLUMN "updatedAt" TYPE timestamptz USING "updatedAt" AT TIME ZONE 'Asia/Almaty';

COMMIT;
