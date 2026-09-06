ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS profile_gallery (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_asset_id uuid NOT NULL UNIQUE REFERENCES media_assets(id) ON DELETE CASCADE,
  position smallint NOT NULL DEFAULT 0 CHECK(position BETWEEN 0 AND 23),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, media_asset_id),
  UNIQUE(user_id, position)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_media_attached_once ON media_assets(attached_kind,attached_id) WHERE attached_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_gallery_user_position ON profile_gallery(user_id,position);
