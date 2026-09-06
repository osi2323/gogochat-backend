CREATE TABLE IF NOT EXISTS notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 actor_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
 type varchar(40) NOT NULL,
 data jsonb NOT NULL DEFAULT '{}'::jsonb,
 read_at timestamptz NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id,created_at DESC) WHERE read_at IS NULL;
ALTER TABLE wall_posts ADD COLUMN IF NOT EXISTS updated_at timestamptz NULL;
ALTER TABLE wall_posts ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS idx_wall_posts_live_author_created ON wall_posts(author_id,created_at DESC,id DESC) WHERE deleted_at IS NULL;
