-- Portal settings per location (URL display, icon, auto-invite)
ALTER TABLE location_settings
  ADD COLUMN IF NOT EXISTS portal_icon_url text,
  ADD COLUMN IF NOT EXISTS portal_welcome_message text DEFAULT 'Benvenuto! Accedi al tuo portale clienti per visualizzare i tuoi dati.',
  ADD COLUMN IF NOT EXISTS portal_auto_invite boolean DEFAULT false;
