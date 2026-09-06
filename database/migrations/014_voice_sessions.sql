CREATE TABLE IF NOT EXISTS voice_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, participant_identity varchar(160) NOT NULL UNIQUE,
 started_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, ended_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT voice_session_time CHECK (expires_at > started_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_active_user_room ON voice_sessions(room_id,user_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_voice_expiry ON voice_sessions(expires_at) WHERE ended_at IS NULL;
