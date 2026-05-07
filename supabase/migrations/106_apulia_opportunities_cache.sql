-- ============================================================
-- Apulia opportunities + pipelines cache
-- ============================================================
-- The Opportunità module needs sub-second renders and supports drag-
-- and-drop, so live-fetching from GHL on every page load is too slow
-- (the /opportunities/search endpoint paginates 100/page and each
-- request takes ~250-500ms). Mirror the data in two cache tables that
-- the worker keeps in sync.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.apulia_pipelines (
  ghl_id      TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  stages      JSONB NOT NULL DEFAULT '[]'::jsonb,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.apulia_opportunities (
  ghl_id              TEXT PRIMARY KEY,
  name                TEXT,
  pipeline_id         TEXT NOT NULL REFERENCES public.apulia_pipelines(ghl_id) ON DELETE CASCADE,
  pipeline_stage_id   TEXT NOT NULL,
  contact_ghl_id      TEXT,
  monetary_value      NUMERIC(14, 2),
  status              TEXT,
  source              TEXT,
  assigned_to         TEXT,
  ghl_updated_at      TIMESTAMPTZ,
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apulia_opportunities_pipeline ON public.apulia_opportunities(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_apulia_opportunities_stage ON public.apulia_opportunities(pipeline_stage_id);
CREATE INDEX IF NOT EXISTS idx_apulia_opportunities_contact ON public.apulia_opportunities(contact_ghl_id);

ALTER TABLE public.apulia_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apulia_opportunities ENABLE ROW LEVEL SECURITY;

-- Service role only — owner UI hits this through the admin client.
DROP POLICY IF EXISTS apulia_pipelines_service ON public.apulia_pipelines;
CREATE POLICY apulia_pipelines_service ON public.apulia_pipelines FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS apulia_opportunities_service ON public.apulia_opportunities;
CREATE POLICY apulia_opportunities_service ON public.apulia_opportunities FOR ALL TO service_role USING (true) WITH CHECK (true);
