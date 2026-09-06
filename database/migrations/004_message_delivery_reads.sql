ALTER TABLE messages ADD COLUMN IF NOT EXISTS client_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_user_client ON messages(user_id,client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_room_cursor ON messages(room_id,created_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS room_reads(
 room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 last_read_message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
 last_read_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(room_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_room_reads_user ON room_reads(user_id,last_read_at DESC);
