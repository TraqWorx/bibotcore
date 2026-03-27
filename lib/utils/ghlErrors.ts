/**
 * Translate raw GHL API error messages into user-friendly Italian messages.
 */
const ERROR_MAP: [RegExp | string, string][] = [
  [/duplicate opportunity/i, 'Esiste già un\'opportunità per questo contatto in questa pipeline.'],
  [/duplicated contacts/i, 'Esiste già un contatto con questi dati.'],
  [/email must be an email/i, 'L\'indirizzo email non è valido.'],
  [/phone.*invalid|invalid.*phone/i, 'Il numero di telefono non è valido.'],
  [/not found/i, 'Risorsa non trovata. Potrebbe essere stata eliminata.'],
  [/unauthorized|forbidden/i, 'Accesso non autorizzato. Prova a riconnetterti.'],
  [/rate limit/i, 'Troppe richieste. Riprova tra qualche secondo.'],
  [/bad request/i, 'Richiesta non valida. Verifica i dati inseriti.'],
  [/internal server error/i, 'Errore del server GHL. Riprova tra poco.'],
]

export function translateGhlError(err: unknown, fallback = 'Si è verificato un errore. Riprova.'): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  if (!raw) return fallback

  for (const [pattern, message] of ERROR_MAP) {
    if (typeof pattern === 'string' ? raw.includes(pattern) : pattern.test(raw)) {
      return message
    }
  }

  // If the raw message contains JSON, try to extract the human-readable part
  try {
    const parsed = JSON.parse(raw)
    if (parsed.message) {
      const msg = Array.isArray(parsed.message) ? parsed.message[0] : parsed.message
      if (typeof msg === 'string') {
        // Re-run through patterns on extracted message
        for (const [pattern, message] of ERROR_MAP) {
          if (typeof pattern === 'string' ? msg.includes(pattern) : pattern.test(msg)) {
            return message
          }
        }
      }
    }
  } catch {
    // Not JSON, that's fine
  }

  return fallback
}
