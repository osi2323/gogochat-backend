CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  allow_private_messages boolean NOT NULL DEFAULT true,
  allow_voice_calls boolean NOT NULL DEFAULT true,
  allow_video_calls boolean NOT NULL DEFAULT true,
  show_online_status boolean NOT NULL DEFAULT true,
  notify_dm boolean NOT NULL DEFAULT true,
  notify_friend boolean NOT NULL DEFAULT true,
  notify_follow boolean NOT NULL DEFAULT true,
  notify_wall boolean NOT NULL DEFAULT true,
  compact_messages boolean NOT NULL DEFAULT true,
  reduce_motion boolean NOT NULL DEFAULT false,
  sound_enabled boolean NOT NULL DEFAULT true,
  language varchar(8) NOT NULL DEFAULT 'tr',
  updated_at timestamptz NOT NULL DEFAULT now()
);
