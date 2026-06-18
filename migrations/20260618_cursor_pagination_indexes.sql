CREATE INDEX IF NOT EXISTS "idx_post_created_at_id"
  ON "post" ("createdAt" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "idx_post_author_created_at_id"
  ON "post" ("authorId", "createdAt" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "idx_notification_user_created_at_id"
  ON "notification" ("userId", "createdAt" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "idx_message_chat_room_created_at_id"
  ON "message" ("chatRoomId", "createdAt" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "idx_chat_room_updated_at_id"
  ON "chat_room" ("updatedAt" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "idx_user_created_at_id"
  ON "user" ("createdAt" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "idx_friend_requester_status_created_at_id"
  ON "friend" ("requesterId", "status", "createdAt" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "idx_friend_receiver_status_created_at_id"
  ON "friend" ("receiverId", "status", "createdAt" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "idx_chat_room_participants_user_user_room"
  ON "chat_room_participants_user" ("userId", "chatRoomId");
