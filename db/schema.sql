-- ═══════════════════════════════════════════════════
-- Qntum Designs — Supabase Schema
-- ═══════════════════════════════════════════════════
-- Dieses SQL in der Supabase SQL-Konsole ausführen.
-- Supabase Auth (auth.users) wird automatisch verwaltet.

-- ── Benutzer-Profile ──────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT 'explorer',
  tokens_used BIGINT NOT NULL DEFAULT 0,
  tokens_limit BIGINT NOT NULL DEFAULT 30000,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profile werden vom Backend-Code erstellt (kein Trigger nötig)


-- ── Projekte ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Neues Projekt',
  description TEXT DEFAULT '',
  current_html TEXT DEFAULT '',
  project_files JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  slug TEXT UNIQUE,
  custom_domain TEXT UNIQUE,
  published_at TIMESTAMPTZ,
  thumbnail_color TEXT DEFAULT '#00E68A',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_domain ON projects(custom_domain) WHERE custom_domain IS NOT NULL;


-- ── Chat-Nachrichten ──────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id);


-- ── Versionen (Snapshots) ─────────────────────────
CREATE TABLE IF NOT EXISTS versions (
  id BIGSERIAL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  html TEXT NOT NULL,
  label TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_versions_project ON versions(project_id);


-- ── Row Level Security ────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE versions ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile; service_role can insert
CREATE POLICY profiles_select ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (auth.uid() = id);

-- Projects: users can only access their own projects
CREATE POLICY projects_select ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY projects_insert ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY projects_update ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY projects_delete ON projects FOR DELETE USING (auth.uid() = user_id);

-- Messages: users can access messages of their own projects
CREATE POLICY messages_select ON messages FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY messages_insert ON messages FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Versions: same as messages
CREATE POLICY versions_select ON versions FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY versions_insert ON versions FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
