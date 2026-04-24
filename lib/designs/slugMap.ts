/**
 * Maps design DB slugs to route folder names.
 * Only needed when the DB slug differs from the folder name.
 */
const SLUG_TO_FOLDER: Record<string, string> = {
  'apulian-tourism-service': 'apulia-tourism',
}

/** Convert a DB design slug to the route folder name used in /designs/{folder}/ */
export function designSlugToFolder(dbSlug: string): string {
  return SLUG_TO_FOLDER[dbSlug] ?? dbSlug
}
