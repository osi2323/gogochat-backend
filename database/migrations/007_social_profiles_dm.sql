ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS follows (
 follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 following_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (follower_id, following_id),
 CONSTRAINT follows_no_self CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS follows_following_idx ON follows(following_id, created_at DESC);

CREATE TABLE IF NOT EXISTS friendships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 addressee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT friendships_no_self CHECK (requester_id <> addressee_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_unique ON friendships (LEAST(requester_id,addressee_id), GREATEST(requester_id,addressee_id));

CREATE TABLE IF NOT EXISTS direct_conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 pair_key varchar(73) NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS direct_conversation_members (
 conversation_id uuid NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 last_read_at timestamptz,
 PRIMARY KEY(conversation_id,user_id)
);
CREATE TABLE IF NOT EXISTS direct_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id uuid NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
 sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 client_id uuid NOT NULL,
 body varchar(4000) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 edited_at timestamptz,
 deleted_at timestamptz,
 CONSTRAINT dm_body_nonblank CHECK (length(btrim(body)) > 0),
 UNIQUE(sender_id, client_id)
);
CREATE INDEX IF NOT EXISTS dm_conversation_time_idx ON direct_messages(conversation_id,created_at DESC,id DESC);
