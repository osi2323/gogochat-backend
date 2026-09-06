ALTER TABLE room_members ADD COLUMN IF NOT EXISTS muted_until timestamptz;
CREATE INDEX IF NOT EXISTS idx_room_members_muted ON room_members(room_id, muted_until) WHERE muted_until IS NOT NULL;
CREATE TABLE IF NOT EXISTS room_bans(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 reason varchar(500), expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(room_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_room_bans_active ON room_bans(room_id,user_id,expires_at);
UPDATE ranks SET permissions=permissions || '{"room.mute":true,"room.kick":true,"room.ban":true}'::jsonb WHERE star_count=27;
