/**
 * One-shot: translate any English error messages currently sitting on
 * apulia_sync_queue / apulia_contacts to Italian. Re-runs are safe — we
 * only update rows where the message still matches the old English form.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = readFileSync('/Users/dan/Desktop/bibotcrm/.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Replace English-form messages with Italian. Pattern-based: rewrite the
// phrase only, keeping any GHL ids and names already embedded.
const replacements = [
  {
    test: /^Email collision: GHL contact (\S+) already linked to admin (.+?) \(code (\S+)\)\..*$/,
    rewrite: (m) => `Collisione email: il contatto GHL ${m[1]} è già collegato all'amministratore ${m[2]} (codice ${m[3]}). Due amministratori nel file condividono questa email; rimuovi i duplicati e reimporta questo.`,
  },
  {
    test: /^GHL contact (\S+) is already linked to another Bibot row \(email\/phone collision(?: via upsert fallback)?\)\. Likely duplicate input row\.$/,
    rewrite: (m) => `Il contatto GHL ${m[1]} è già collegato a un'altra riga Bibot (collisione email/telefono). Probabile riga duplicata in input.`,
  },
  {
    test: /^GHL did not return a contact id$/,
    rewrite: () => `GHL non ha restituito un id contatto`,
  },
  {
    test: /^GHL rate-limited; paused 90s$/,
    rewrite: () => `Rate limit GHL: pausa di 90 secondi prima di riprovare`,
  },
  {
    test: /^awaiting create$/,
    rewrite: () => `In attesa della creazione su GHL`,
  },
]

const { data: ops } = await sb
  .from('apulia_sync_queue')
  .select('id, last_error')
  .not('last_error', 'is', null)

let updated = 0
for (const o of ops ?? []) {
  const cur = (o.last_error ?? '').trim()
  for (const r of replacements) {
    const m = cur.match(r.test)
    if (m) {
      await sb.from('apulia_sync_queue').update({ last_error: r.rewrite(m) }).eq('id', o.id)
      updated++
      break
    }
  }
}
console.log(`Translated ${updated} queue op messages.`)

// Same for apulia_contacts.sync_error
const { data: rows } = await sb
  .from('apulia_contacts')
  .select('id, sync_error')
  .not('sync_error', 'is', null)
let updatedRows = 0
for (const o of rows ?? []) {
  const cur = (o.sync_error ?? '').trim()
  for (const r of replacements) {
    const m = cur.match(r.test)
    if (m) {
      await sb.from('apulia_contacts').update({ sync_error: r.rewrite(m) }).eq('id', o.id)
      updatedRows++
      break
    }
  }
}
console.log(`Translated ${updatedRows} contact rows.`)
