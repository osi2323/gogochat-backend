ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS moderation_audit_logs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 target_user_id uuid REFERENCES users(id) ON DELETE SET NULL, room_id uuid REFERENCES rooms(id) ON DELETE SET NULL,
 message_id uuid, action varchar(40) NOT NULL, reason varchar(500), metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_moderation_audit_room_created ON moderation_audit_logs(room_id,created_at DESC);
UPDATE ranks SET permissions = permissions || '{"room.moderateMessages":true,"room.audit":true}'::jsonb WHERE star_count=27;
