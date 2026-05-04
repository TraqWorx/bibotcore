'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { ghlFetch } from '@/lib/apulia/ghl'
import { APULIA_FIELD, currentPeriod } from '@/lib/apulia/fields'
import { patchCached } from '@/lib/apulia/cache'
import { APULIA_IMPERSONATE_COOKIE } from '@/lib/apulia/auth'

async function ensureOwner(): Promise<{ email: string } | { error: string }> {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id, role').eq('id', user.id).single()
  if (!profile?.agency_id || !isBibotAgency(profile.agency_id)) return { error: 'Forbidden' }
  if (profile.role !== 'admin' && profile.role !== 'super_admin') return { error: 'Forbidden' }
  return { email: user.email ?? '' }
}

export async function setPodOverride(podContactId: string, amount: number, adminContactId: string): Promise<{ error: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard

  // 1. Update GHL with the new override value.
  const value = amount > 0 ? amount : ''
  const r = await ghlFetch(`/contacts/${podContactId}`, {
    method: 'PUT',
    body: JSON.stringify({ customFields: [{ id: APULIA_FIELD.POD_OVERRIDE, value }] }),
  })
  if (!r.ok) return { error: `Bibot ${r.status}: ${(await r.text()).slice(0, 200)}` }

  // 2. Patch the local cache for this POD.
  await patchCached(podContactId, { pod_override: amount > 0 ? amount : null })

  // 3. Recompute just the affected admin's total from cache (fast — no
  //    full GHL refetch). Then push the new total to GHL + cache.
  const sb = createAdminClient()
  const { data: admin } = await sb
    .from('apulia_contacts')
    .select('codice_amministratore, compenso_per_pod')
    .eq('id', adminContactId)
    .single()
  if (admin?.codice_amministratore) {
    const { data: pods } = await sb
      .from('apulia_contacts')
      .select('pod_override')
      .eq('codice_amministratore', admin.codice_amministratore)
      .eq('is_amministratore', false)
      .eq('is_switch_out', false)
    const compenso = Number(admin.compenso_per_pod) || 0
    const newTotal = (pods ?? []).reduce(
      (s, p) => s + (Number(p.pod_override) || compenso),
      0,
    )
    // Push to GHL + cache
    const tr = await ghlFetch(`/contacts/${adminContactId}`, {
      method: 'PUT',
      body: JSON.stringify({ customFields: [{ id: APULIA_FIELD.COMMISSIONE_TOTALE, value: newTotal }] }),
    })
    if (tr.ok) {
      await patchCached(adminContactId, { commissione_totale: newTotal })
    }
  }

  revalidatePath(`/designs/apulia-power/amministratori/${adminContactId}`)
  revalidatePath('/designs/apulia-power/amministratori')
  revalidatePath('/designs/apulia-power/dashboard')
}

export async function markPaid(adminContactId: string, amountCents: number, note?: string): Promise<{ error: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard

  const sb = createAdminClient()
  // Look up the admin's schedule to determine the period being paid.
  const { data: schedule } = await sb.rpc('apulia_admin_schedule')
  type ScheduleRow = { contact_id: string; first_payment_at: string | null; paid_count: number; next_period_idx: number; next_due_date: string | null; is_due_now: boolean; overdue_count: number }
  const sched = ((schedule ?? []) as ScheduleRow[]).find((s) => s.contact_id === adminContactId)
  if (!sched) return { error: 'Schedule non trovato' }
  if (!sched.first_payment_at) return { error: "Imposta prima la data del 1° pagamento dell'amministratore" }

  const { error } = await sb.from('apulia_payments').insert({
    contact_id: adminContactId,
    period: `idx-${sched.next_period_idx}`,
    period_idx: sched.next_period_idx,
    period_due_date: sched.next_due_date,
    amount_cents: amountCents,
    paid_at: new Date().toISOString(),
    paid_by: guard.email,
    note: note ?? null,
  })
  if (error) return { error: error.message }

  revalidatePath(`/designs/apulia-power/amministratori/${adminContactId}`)
  revalidatePath('/designs/apulia-power/amministratori')
  revalidatePath('/designs/apulia-power/pagamenti')
  revalidatePath('/designs/apulia-power/dashboard')
}

export async function unmarkPaid(adminContactId: string): Promise<{ error: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard

  const sb = createAdminClient()
  const { data: latest } = await sb
    .from('apulia_payments')
    .select('id')
    .eq('contact_id', adminContactId)
    .not('period_idx', 'is', null)
    .order('period_idx', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!latest) return { error: 'Nessun pagamento da annullare' }
  const { error } = await sb.from('apulia_payments').delete().eq('id', latest.id)
  if (error) return { error: error.message }

  revalidatePath(`/designs/apulia-power/amministratori/${adminContactId}`)
  revalidatePath('/designs/apulia-power/amministratori')
  revalidatePath('/designs/apulia-power/pagamenti')
  revalidatePath('/designs/apulia-power/dashboard')
}

export async function setFirstPaymentDate(adminContactId: string, isoDate: string): Promise<{ error: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return { error: 'Data non valida' }
  const sb = createAdminClient()
  const { error } = await sb.from('apulia_contacts').update({ first_payment_at: d.toISOString() }).eq('id', adminContactId)
  if (error) return { error: error.message }
  revalidatePath(`/designs/apulia-power/amministratori/${adminContactId}`)
  revalidatePath('/designs/apulia-power/amministratori')
  revalidatePath('/designs/apulia-power/dashboard')
  revalidatePath('/designs/apulia-power/settings')
}

/**
 * Owner-only: temporarily render the design as if logged in as a specific
 * amministratore. Sets a cookie consumed by getApuliaSession; the owner can
 * exit via the banner shown in the layout.
 */
export async function startImpersonation(adminContactId: string): Promise<{ error: string } | undefined> {
  const guard = await ensureOwner()
  if ('error' in guard) return guard

  const sb = createAdminClient()
  const { data: target } = await sb
    .from('apulia_contacts')
    .select('id')
    .eq('id', adminContactId)
    .eq('is_amministratore', true)
    .maybeSingle()
  if (!target) return { error: 'Amministratore non trovato' }

  const cookieStore = await cookies()
  cookieStore.set(APULIA_IMPERSONATE_COOKIE, adminContactId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60, // 1 hour
  })
}

export async function exitImpersonation(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(APULIA_IMPERSONATE_COOKIE)
}
