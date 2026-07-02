-- Custom waiting-list invite text (per location). Placeholders:
-- {{nome}} {{servizio}} {{giorno}} {{link}}
alter table bellessere_settings add column if not exists invite_text text;
