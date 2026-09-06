-- Admin content moderation permission. Existing permission maps are preserved.
UPDATE ranks
SET permissions = COALESCE(permissions, '{}'::jsonb) || '{"admin.content": true}'::jsonb
WHERE star_count = 27;
