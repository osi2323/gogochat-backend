CREATE TABLE IF NOT EXISTS site_settings(key varchar(80) PRIMARY KEY,value jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO site_settings(key,value) VALUES ('site.name','"GogoChat"'::jsonb),('site.description','"Feather sosyal sohbet"'::jsonb),('guest.enabled','true'::jsonb),('wall.enabled','true'::jsonb) ON CONFLICT(key) DO NOTHING;
UPDATE ranks SET permissions=permissions||'{"admin.access":true,"admin.all":true,"admin.users":true,"admin.ranks":true,"admin.rooms":true,"admin.settings":true}'::jsonb WHERE star_count=27;
