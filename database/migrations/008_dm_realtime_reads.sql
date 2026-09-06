ALTER TABLE direct_conversation_members ADD COLUMN IF NOT EXISTS last_read_message_id uuid REFERENCES direct_messages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS dm_members_user_idx ON direct_conversation_members(user_id, conversation_id);
CREATE INDEX IF NOT EXISTS dm_unread_idx ON direct_messages(conversation_id, created_at DESC) WHERE deleted_at IS NULL;
