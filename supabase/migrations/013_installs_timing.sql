-- Add timing columns and last_error to installs
ALTER TABLE installs
  ADD COLUMN IF NOT EXISTS install_started_at   timestamptz,
  ADD COLUMN IF NOT EXISTS install_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error           text;
