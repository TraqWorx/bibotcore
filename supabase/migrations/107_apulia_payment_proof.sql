-- ============================================================
-- 107: Payment proof attachment + editable note metadata.
--
-- proof_url      — public URL of the uploaded receipt in Supabase Storage
--                  (bucket `apulia-payment-proofs`). NULL until uploaded.
-- proof_name     — original filename (for display).
-- proof_uploaded_at — when the proof landed.
-- note_edited_at — timestamps the last inline note edit so the UI can
--                  show "modificata il …" without diffing.
-- ============================================================

ALTER TABLE public.apulia_payments
  ADD COLUMN IF NOT EXISTS proof_url        TEXT,
  ADD COLUMN IF NOT EXISTS proof_name       TEXT,
  ADD COLUMN IF NOT EXISTS proof_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS note_edited_at   TIMESTAMPTZ;

-- Storage bucket for proof PDFs/images. Idempotent.
INSERT INTO storage.buckets (id, name, public)
VALUES ('apulia-payment-proofs', 'apulia-payment-proofs', true)
ON CONFLICT (id) DO NOTHING;
