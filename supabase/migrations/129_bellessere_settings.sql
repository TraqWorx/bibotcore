-- Bellessere per-location settings (server-readable, unlike the localStorage
-- reminder template). Currently holds the waiting-list notification channel.

create table if not exists bellessere_settings (
  location_id    text primary key,
  invite_channel text not null default 'SMS',  -- GHL message type: SMS | WhatsApp | Email
  updated_at     timestamptz default now()
);
