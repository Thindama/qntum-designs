-- ═══════════════════════════════════════════════════
-- Atomares Token-Increment (verhindert Race Conditions)
-- ═══════════════════════════════════════════════════
-- Dieses SQL in der Supabase SQL-Konsole ausführen.

CREATE OR REPLACE FUNCTION increment_tokens(user_id UUID, amount BIGINT)
RETURNS BIGINT AS $$
DECLARE
  new_total BIGINT;
BEGIN
  UPDATE profiles
  SET tokens_used = tokens_used + amount
  WHERE id = user_id
  RETURNING tokens_used INTO new_total;

  RETURN COALESCE(new_total, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
