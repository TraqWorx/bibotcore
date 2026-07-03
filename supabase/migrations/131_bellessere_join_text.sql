-- Custom "you're on the waiting list" confirmation message sent on join.
-- Placeholders: {{nome}} {{servizio}}
alter table bellessere_settings add column if not exists join_text text;
