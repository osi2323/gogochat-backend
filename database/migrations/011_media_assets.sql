CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose varchar(24) NOT NULL CHECK (purpose IN ('avatar','cover','gallery','wall','room','dm')),
  storage_key text NOT NULL UNIQUE,
  public_url text NOT NULL,
  mime_type varchar(80) NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0),
  attached_kind varchar(24),
  attached_id uuid,
  attached_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT media_attachment_complete CHECK (
    (attached_kind IS NULL AND attached_id IS NULL AND attached_at IS NULL) OR
    (attached_kind IS NOT NULL AND attached_id IS NOT NULL AND attached_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_media_owner_created ON media_assets(owner_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_unclaimed ON media_assets(created_at) WHERE attached_id IS NULL AND deleted_at IS NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photo_urls text[] NOT NULL DEFAULT '{}';
ALTER TABLE wall_posts ADD COLUMN IF NOT EXISTS media_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL;
