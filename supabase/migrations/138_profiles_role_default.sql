-- Migration 137 narrowed profiles.role to super_admin/admin/agency but left the
-- column defaulting to the old 'client', so the signup trigger (handle_new_user
-- inserts id + email only) failed the CHECK and EVERY new auth user was rejected:
-- a portal contact's first login, a newly synced GHL team member, an invite.
-- Default to the least-privileged role instead.
alter table public.profiles alter column role set default 'agency';
