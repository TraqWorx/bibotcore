export const EMBED_TOKEN_HEADER = 'x-embed-token'

/** Headers that let widget data requests on a public /embed page authenticate with its token. */
export function embedTokenHeaders(): Record<string, string> {
  if (typeof window === 'undefined' || !window.location.pathname.startsWith('/embed/')) return {}
  const token = new URLSearchParams(window.location.search).get('token')
  return token ? { [EMBED_TOKEN_HEADER]: token } : {}
}
