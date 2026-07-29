-- Reminder template was stored per-browser in localStorage; move it to the
-- shared settings row so every staff member/device sees the same template.
alter table bellessere_settings add column if not exists reminder_text text;
