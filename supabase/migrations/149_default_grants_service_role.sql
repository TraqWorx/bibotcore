-- From 30 October 2026, Supabase stops automatically granting Data API access
-- to new tables in `public`. Existing tables keep the grants they have, so
-- nothing in this database changes — but from that date a `create table` in a
-- migration produces a table no role can read, and this app talks to PostgREST
-- as service_role, which needs a grant like any other role (bypassing RLS is
-- not the same as being granted).
--
-- Without this, the next new table returns "permission denied" to our own
-- code, and rebuilding this schema from scratch (a new project, a preview
-- branch, `supabase db reset`) produces a database where nothing is readable.
--
-- Supabase's own guidance also grants anon and authenticated. We deliberately
-- do not: migrations 135/136 put RLS on every table with no policies, and 142
-- revoked function execution from PUBLIC. Granting those roles here would undo
-- that. service_role is the only role the application uses.

alter default privileges in schema public
  grant all on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to service_role;
