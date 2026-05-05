import { fetchAllContacts, indexByPodPdr, addTag, pmap } from './contacts'
import { APULIA_TAG } from './fields'
import { recomputeCommissions, type RecomputeResult } from './recompute'

export type SwitchOutEvent =
  | { type: 'preflight' }
  | { type: 'start'; total: number }
  | { type: 'progress'; done: number; total: number; tagged: number; alreadyTagged: number; unmatched: number; skipped: number }
  | { type: 'recompute' }
  | { type: 'done'; tagged: number; alreadyTagged: number; unmatched: number; skipped: number; recompute: RecomputeResult; durationMs: number }
  | { type: 'error'; message: string }

const POD_COL_CANDIDATES = ['Pod Pdr', 'POD/PDR', 'POD PDR']

export async function* importSwitchOut(rows: Record<string, string>[]): AsyncGenerator<SwitchOutEvent> {
  const startedAt = Date.now()
  yield { type: 'preflight' }

  const existing = await fetchAllContacts()
  const byPod = indexByPodPdr(existing)
  const podColumn = POD_COL_CANDIDATES.find((c) => rows[0] && c in rows[0])

  yield { type: 'start', total: rows.length }

  let tagged = 0, alreadyTagged = 0, unmatched = 0, skipped = 0, done = 0

  const CHUNK = 40
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    await pmap(chunk, async (row) => {
      const pod = podColumn ? (row[podColumn] || '').toUpperCase().trim() : ''
      if (!pod) { skipped++; done++; return }
      const c = byPod.get(pod)
      if (!c) { unmatched++; done++; return }
      if (c.tags?.includes(APULIA_TAG.SWITCH_OUT)) { alreadyTagged++; done++; return }
      try {
        await addTag(c.id, APULIA_TAG.SWITCH_OUT)
        tagged++
      } catch (err) {
        console.error(`[importSwitchOut] tag failed (POD ${pod}):`, err)
        unmatched++
      } finally {
        done++
      }
    }, 8)
    yield { type: 'progress', done, total: rows.length, tagged, alreadyTagged, unmatched, skipped }
  }

  yield { type: 'recompute' }
  const recompute = await recomputeCommissions()

  yield { type: 'done', tagged, alreadyTagged, unmatched, skipped, recompute, durationMs: Date.now() - startedAt }
}
