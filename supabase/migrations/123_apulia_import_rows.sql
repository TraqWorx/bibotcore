-- Per-row outcome of each Apulia import, so the imports UI can show every file
-- row with its status (created / updated / reactivated / skipped / duplicate /
-- tagged / already / unmatched) — not just aggregate counts.
--
-- Populated best-effort by the importers (failure to record never breaks the
-- import). Service-role only, like the rest of the apulia_* tables.

CREATE TABLE IF NOT EXISTS public.apulia_import_rows (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id   uuid NOT NULL REFERENCES public.apulia_imports(id) ON DELETE CASCADE,
  row_index   int,
  identifier  text,        -- POD/PDR or codice amministratore
  label       text,        -- name / cliente for display
  outcome     text NOT NULL,
  reason      text,        -- e.g. 'no_pod', 'missing_name_or_code'
  contact_id  uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS apulia_import_rows_import_idx
  ON public.apulia_import_rows (import_id);

CREATE INDEX IF NOT EXISTS apulia_import_rows_import_outcome_idx
  ON public.apulia_import_rows (import_id, outcome);

ALTER TABLE public.apulia_import_rows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS apulia_import_rows_service ON public.apulia_import_rows;
CREATE POLICY apulia_import_rows_service
  ON public.apulia_import_rows FOR ALL TO service_role
  USING (true) WITH CHECK (true);
