-- ============================================================
-- 074: Enable RLS on remaining public tables
-- ============================================================
-- Supabase flagged these as rls_disabled_in_public.
-- All three are only accessed server-side via createAdminClient()
-- (service role bypasses RLS), so enabling RLS with no policies
-- is the correct lockdown — same pattern as migration 040.
-- ============================================================

ALTER TABLE IF EXISTS vat_quarter_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS drip_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS _cron_config ENABLE ROW LEVEL SECURITY;
