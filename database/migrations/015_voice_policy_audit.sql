ALTER TABLE rooms ADD COLUMN IF NOT EXISTS max_microphones integer NOT NULL DEFAULT 5;
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_max_microphones_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_max_microphones_check CHECK (max_microphones BETWEEN 1 AND 20);
CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_active_user_global ON voice_sessions(user_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_voice_active_room ON voice_sessions(room_id, started_at) WHERE ended_at IS NULL;
UPDATE ranks SET permissions = permissions || '{"room.voiceModerate":true,"room.audit":true,"room.moderateMessages":true}'::jsonb WHERE star_count = 27;
