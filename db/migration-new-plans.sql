-- ═══════════════════════════════════════════════════
-- Migration: Neue Plan-Struktur (Explorer/Starter/Pro/Business)
-- ═══════════════════════════════════════════════════
-- Dieses SQL in der Supabase SQL-Konsole ausführen.

-- 1. Default-Werte der profiles-Tabelle anpassen
ALTER TABLE profiles ALTER COLUMN plan SET DEFAULT 'explorer';
ALTER TABLE profiles ALTER COLUMN tokens_limit SET DEFAULT 30000;

-- 2. Bestehende "free"-User auf "explorer" migrieren
UPDATE profiles
SET plan = 'explorer', tokens_limit = 30000
WHERE plan = 'free';

-- 3. Bestehende User mit alten Token-Limits korrigieren
-- (Nur wenn sie noch die alten Default-Werte haben und kein aktives Stripe-Abo)
UPDATE profiles
SET tokens_limit = 30000
WHERE plan = 'explorer' AND tokens_limit = 500000 AND stripe_subscription_id IS NULL;
