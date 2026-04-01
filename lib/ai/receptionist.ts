/**
 * AI Receptionist — handles initial inbound messages.
 * Qualifies the lead (name, issue) and routes to the right team member.
 * Only activates for unassigned conversations.
 */

import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase-server'
import { getGhlClient } from '@/lib/ghl/ghlClient'

const MODEL = 'claude-sonnet-4-20250514'

export async function handleInboundMessage(
  locationId: string,
  conversationId: string,
  contactId: string,
  messageBody: string,
) {
  const sb = createAdminClient()

  // Check if AI receptionist is enabled for this location
  const { data: moduleSettings } = await sb
    .from('location_design_settings')
    .select('module_overrides')
    .eq('location_id', locationId)
    .maybeSingle()
  const overrides = (moduleSettings?.module_overrides ?? {}) as Record<string, { enabled?: boolean }>
  if (overrides.ai?.enabled === false) return // AI disabled

  // Check if location has receptionist enabled in settings
  const { data: settings } = await sb
    .from('location_settings')
    .select('ai_receptionist')
    .eq('location_id', locationId)
    .maybeSingle()
  if (!(settings as Record<string, unknown>)?.ai_receptionist) return // Receptionist disabled

  // Check if conversation is already assigned
  const { data: metadata } = await sb
    .from('conversation_metadata')
    .select('assigned_to')
    .eq('location_id', locationId)
    .eq('conversation_id', conversationId)
    .maybeSingle()
  const currentAssignee = metadata?.assigned_to ?? null

  // Get conversation history from cache
  const { data: cachedMessages } = await sb
    .from('cached_messages')
    .select('body, direction, date_added')
    .eq('location_id', locationId)
    .eq('conversation_id', conversationId)
    .order('date_added', { ascending: true })
    .limit(20)

  const history = (cachedMessages ?? []).map((m) =>
    `${m.direction === 'inbound' ? 'Cliente' : 'Assistente'}: ${m.body}`
  ).join('\n')

  // Get contact info
  const { data: contact } = await sb
    .from('cached_contacts')
    .select('first_name, last_name, email, phone')
    .eq('location_id', locationId)
    .eq('ghl_id', contactId)
    .maybeSingle()

  const contactName = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(' ')
    : null

  // Get available team members
  const { data: users } = await sb
    .from('cached_ghl_users')
    .select('ghl_id, name, email, role')
    .eq('location_id', locationId)

  const teamList = (users ?? [])
    .filter((u) => u.name)
    .map((u, i) => `${i + 1}. ${u.name}`)
    .join('\n')

  // Build AI prompt
  const systemPrompt = `Sei un assistente virtuale di accoglienza per un'azienda italiana. Il tuo compito è:
1. Salutare il cliente in modo cordiale
2. Se non conosci il nome, chiederlo
3. Chiedere brevemente qual è il motivo del contatto
4. Proporre la lista dei collaboratori disponibili e chiedere con chi vogliono parlare
5. Quando il cliente sceglie un collaboratore, rispondi SOLO con: [ASSEGNA:nome_collaboratore]

Regole:
- Rispondi SEMPRE in italiano
- Sii breve e professionale (max 2-3 frasi)
- Non inventare informazioni sull'azienda
- Se il cliente ha già dato nome e motivo, vai diretto alla lista collaboratori
- Se il cliente sceglie un numero o nome dalla lista, rispondi con [ASSEGNA:nome]
- Se la conversazione è già assegnata e il cliente chiede di parlare con qualcun altro, mostra la lista

Collaboratori disponibili:
${teamList}

${contactName ? `Il cliente si chiama: ${contactName}` : 'Nome del cliente non ancora noto.'}
${currentAssignee ? `La conversazione è attualmente assegnata a un collaboratore. Se il cliente chiede di parlare con qualcun altro, mostra la lista.` : 'La conversazione non è ancora assegnata.'}`

  const messages: Anthropic.MessageParam[] = []
  if (history) {
    messages.push({ role: 'user', content: `Storico conversazione:\n${history}\n\nNuovo messaggio del cliente: ${messageBody}` })
  } else {
    messages.push({ role: 'user', content: `Nuovo messaggio del cliente: ${messageBody}` })
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 256,
      system: systemPrompt,
      messages,
    })

    const aiText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => ('text' in b ? b.text : ''))
      .join('')

    // Check if AI wants to assign
    const assignMatch = aiText.match(/\[ASSEGNA:(.+?)\]/)
    if (assignMatch) {
      const chosenName = assignMatch[1].trim()
      const chosenUser = (users ?? []).find((u) =>
        u.name?.toLowerCase().includes(chosenName.toLowerCase())
      )

      if (chosenUser) {
        // Assign conversation
        await sb.from('conversation_metadata').upsert({
          location_id: locationId,
          conversation_id: conversationId,
          assigned_to: chosenUser.ghl_id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'location_id,conversation_id' })

        // Send confirmation message
        const confirmMsg = `Perfetto! Ti metto in contatto con ${chosenUser.name}. Sarai ricontattato a breve.`
        const ghl = await getGhlClient(locationId)
        await ghl.conversations.send(conversationId, confirmMsg, { type: 'SMS', contactId })

        // Cache the sent message
        await sb.from('cached_messages').upsert({
          ghl_id: `ai-assign-${Date.now()}`,
          location_id: locationId,
          conversation_id: conversationId,
          body: confirmMsg,
          direction: 'outbound',
          type: 'SMS',
          date_added: new Date().toISOString(),
          synced_at: new Date().toISOString(),
        } as never, { onConflict: 'location_id,ghl_id' })

        // Notify the assigned team member
        const { data: memberProfile } = await sb
          .from('profiles')
          .select('id')
          .eq('email', chosenUser.email?.toLowerCase())
          .maybeSingle()
        if (memberProfile) {
          await Promise.resolve(sb.from('notifications').insert({
            user_id: memberProfile.id,
            type: 'conversation_assigned',
            title: `Nuova conversazione assegnata`,
            body: `${contactName ?? 'Un cliente'} vuole parlare con te.`,
            read: false,
          })).catch(() => {})
        }

        console.log(`[receptionist] Assigned ${conversationId} to ${chosenUser.name}`)
        return
      }
    }

    // Send AI reply (remove any [ASSEGNA:...] tags from the message)
    const cleanReply = aiText.replace(/\[ASSEGNA:.+?\]/g, '').trim()
    if (cleanReply) {
      const ghl = await getGhlClient(locationId)
      await ghl.conversations.send(conversationId, cleanReply, { type: 'SMS', contactId })

      // Cache the sent message
      await sb.from('cached_messages').upsert({
        ghl_id: `ai-reply-${Date.now()}`,
        location_id: locationId,
        conversation_id: conversationId,
        body: cleanReply,
        direction: 'outbound',
        type: 'SMS',
        date_added: new Date().toISOString(),
        synced_at: new Date().toISOString(),
      } as never, { onConflict: 'location_id,ghl_id' })

      console.log(`[receptionist] Sent AI reply to ${conversationId}`)
    }
  } catch (err) {
    console.error('[receptionist] Error:', err)
  }
}
