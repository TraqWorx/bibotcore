-- Track design installer progress per install
ALTER TABLE installs
  ADD COLUMN IF NOT EXISTS install_status text,   -- 'installing' | 'installed' | 'failed'
  ADD COLUMN IF NOT EXISTS install_log    text;   -- error message on failure
