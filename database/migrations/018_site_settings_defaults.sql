INSERT INTO site_settings(key,value) VALUES
 ('site.name','"GogoChat"'::jsonb),
 ('site.description','"Yeni nesil sosyal sohbet deneyimi"'::jsonb),
 ('auth.guestEnabled','true'::jsonb),
 ('features.wallEnabled','true'::jsonb),
 ('features.voiceEnabled','true'::jsonb),
 ('ui.announcement','"GogoChat’e hoş geldin ✨"'::jsonb),
 ('ui.mobileHeader','"feather"'::jsonb),
 ('ui.mobileFooter','"feather"'::jsonb)
ON CONFLICT (key) DO NOTHING;
