-- ═══════════════════════════════════════════════════
-- Fix: Registration "Database error creating new user"
-- ═══════════════════════════════════════════════════
-- Dieses SQL in der Supabase SQL-Konsole ausführen.

-- 1. Trigger entfernen (verursacht den Fehler)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- 2. Sicherstellen, dass profiles-Tabelle existiert
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

-- 3. RLS aktivieren + INSERT-Policy hinzufügen
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Bestehende Policies sicher erstellen (DROP IF EXISTS gibt es nicht für Policies)
DO $$ BEGIN
  CREATE POLICY profiles_select ON profiles FOR SELECT USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY profiles_update ON profiles FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
