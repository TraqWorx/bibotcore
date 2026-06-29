-- Lock down conversation helper metadata.
--
-- Migration 048 allowed any authenticated user to read/write these tables.
-- The app accesses them server-side through the service-role client, so browser
-- clients should not have direct table access.

ALTER TABLE IF EXISTS public.conversation_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.note_authors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read conversation_metadata" ON public.conversation_metadata;
DROP POLICY IF EXISTS "Allow authenticated insert conversation_metadata" ON public.conversation_metadata;
DROP POLICY IF EXISTS "Allow authenticated update conversation_metadata" ON public.conversation_metadata;

DROP POLICY IF EXISTS "Allow authenticated read note_authors" ON public.note_authors;
DROP POLICY IF EXISTS "Allow authenticated insert note_authors" ON public.note_authors;

DROP POLICY IF EXISTS conversation_metadata_service ON public.conversation_metadata;
CREATE POLICY conversation_metadata_service
  ON public.conversation_metadata FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS note_authors_service ON public.note_authors;
CREATE POLICY note_authors_service
  ON public.note_authors FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
