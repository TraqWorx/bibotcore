/**
 * Claude AI integration — wraps the Anthropic SDK with per-tenant
 * rate limiting and usage tracking.
 *
 * Env: ANTHROPIC_API_KEY
 *
 * Functions:
 *  - summarizeContact: Generate a summary of a contact's data
 *  - suggestReply: Suggest a reply for a conversation
 *  - generateInsight: Answer analytics questions about cached data
 */

import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase-server'

const MODEL = 'claude-sonnet-4-20250514'
const MAX_TOKENS = 1024

function getClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

// ── Rate limiting ────────────────────────────────────────────

async function checkRateLimit(locationId: string): Promise<{ allowed: boolean; remaining: number }> {
  const sb = createAdminClient()
  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

  // Upsert to create row if missing, reset if new month
  const { data } = await sb
    .from('ai_rate_limits')
    .select('monthly_limit, current_month, tokens_used')
    .eq('location_id', locationId)
    .single()

  if (!data) {
    // Create default rate limit row
    await sb.from('ai_rate_limits').insert({
      location_id: locationId,
      monthly_limit: 100000,
      current_month: currentMonth,
      tokens_used: 0,
    })
    return { allowed: true, remaining: 100000 }
  }

  // Reset if new month
  if (data.current_month !== currentMonth) {
    await sb.from('ai_rate_limits').update({
      current_month: currentMonth,
      tokens_used: 0,
      updated_at: new Date().toISOString(),
    }).eq('location_id', locationId)
    return { allowed: true, remaining: data.monthly_limit }
  }

  const remaining = data.monthly_limit - data.tokens_used
  return { allowed: remaining > 0, remaining }
}

async function recordUsage(
  locationId: string,
  userId: string | null,
  action: string,
  tokensIn: number,
  tokensOut: number,
) {
  const sb = createAdminClient()
  const totalTokens = tokensIn + tokensOut

  await Promise.all([
    // Log individual request
    sb.from('ai_usage').insert({
      location_id: locationId,
      user_id: userId,
      action,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      model: MODEL,
    }),
    // Increment rate limit counter
    sb.rpc('increment_ai_tokens', { p_location_id: locationId, p_tokens: totalTokens })
      .then(({ error }) => {
        // Fallback if RPC doesn't exist: manual update
        if (error) {
          return sb.from('ai_rate_limits')
            .update({
              tokens_used: totalTokens, // Will be overwritten — we need atomic increment
              updated_at: new Date().toISOString(),
            })
            .eq('location_id', locationId)
        }
      }),
  ])
}

// ── Tool-use imports ─────────────────────────────────────────

import { AI_TOOLS, executeTool } from './tools'

// ── Core AI call ─────────────────────────────────────────────

async function callClaude(
  locationId: string,
  userId: string | null,
  action: string,
  systemPrompt: string,
  userMessage: string,
): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  // Check rate limit
  const { allowed, remaining } = await checkRateLimit(locationId)
  if (!allowed) {
    throw new Error(`Limite AI mensile raggiunto. Riprova il prossimo mese. (Rimasti: ${remaining} token)`)
  }

  const client = getClient()
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => ('text' in block ? block.text : ''))
    .join('\n')

  const tokensIn = response.usage.input_tokens
  const tokensOut = response.usage.output_tokens

  // Record usage (non-blocking)
  recordUsage(locationId, userId, action, tokensIn, tokensOut).catch(console.error)

  return { text, tokensIn, tokensOut }
}

// ── Public functions ─────────────────────────────────────────

/**
 * Generate a summary of a contact's profile, deals, and activity.
 */
export async function summarizeContact(
  locationId: string,
  userId: string | null,
  contactData: {
    name: string
    email?: string | null
    phone?: string | null
    tags?: string[]
    customFields?: { name: string; value: string }[]
    opportunities?: { name: string; status: string; value: number }[]
  },
): Promise<string> {
  const systemPrompt = `Sei un assistente CRM per un'azienda italiana. Genera un riepilogo conciso e utile del profilo di un contatto. Scrivi in italiano. Sii breve e diretto — massimo 3-4 paragrafi. Evidenzia punti importanti e potenziali opportunità.`

  const details = [
    `Nome: ${contactData.name}`,
    contactData.email ? `Email: ${contactData.email}` : null,
    contactData.phone ? `Telefono: ${contactData.phone}` : null,
    contactData.tags?.length ? `Tag: ${contactData.tags.join(', ')}` : null,
    contactData.customFields?.length
      ? `Campi personalizzati:\n${contactData.customFields.map((f) => `  - ${f.name}: ${f.value}`).join('\n')}`
      : null,
    contactData.opportunities?.length
      ? `Opportunità:\n${contactData.opportunities.map((o) => `  - ${o.name} (${o.status}, €${o.value})`).join('\n')}`
      : null,
  ].filter(Boolean).join('\n')

  const { text } = await callClaude(
    locationId,
    userId,
    'contact_summary',
    systemPrompt,
    `Genera un riepilogo per questo contatto:\n\n${details}`,
  )
  return text
}

/**
 * Suggest a reply for a conversation based on recent messages.
 */
export async function suggestReply(
  locationId: string,
  userId: string | null,
  context: {
    contactName: string
    conversationType: string
    recentMessages: { direction: string; body: string }[]
  },
): Promise<string> {
  const systemPrompt = `Sei un assistente CRM per un'azienda italiana. Suggerisci una risposta professionale e cortese per una conversazione con un cliente. Scrivi in italiano. La risposta deve essere pronta per l'invio — non aggiungere note o spiegazioni.`

  const messageHistory = context.recentMessages
    .slice(-10) // Last 10 messages
    .map((m) => `${m.direction === 'inbound' ? context.contactName : 'Tu'}: ${m.body}`)
    .join('\n')

  const { text } = await callClaude(
    locationId,
    userId,
    'suggest_reply',
    systemPrompt,
    `Tipo conversazione: ${context.conversationType}\nStorico messaggi:\n${messageHistory}\n\nSuggerisci una risposta:`,
  )
  return text
}

/**
 * Answer an analytics question about the location's data.
 */
export async function generateInsight(
  locationId: string,
  userId: string | null,
  question: string,
  context: {
    totalContacts: number
    categories: { label: string; count: number }[]
    recentDeals: { name: string; status: string; value: number }[]
  },
): Promise<string> {
  const systemPrompt = `Sei un analista CRM per un'azienda italiana. Rispondi a domande sui dati del CRM in modo chiaro e conciso. Scrivi in italiano. Usa numeri e percentuali quando possibile.`

  const dataContext = [
    `Contatti totali: ${context.totalContacts}`,
    `Categorie: ${context.categories.map((c) => `${c.label}: ${c.count}`).join(', ')}`,
    context.recentDeals.length > 0
      ? `Ultimi deal: ${context.recentDeals.map((d) => `${d.name} (${d.status}, €${d.value})`).join('; ')}`
      : 'Nessun deal recente',
  ].join('\n')

  const { text } = await callClaude(
    locationId,
    userId,
    'analytics_insight',
    systemPrompt,
    `Dati disponibili:\n${dataContext}\n\nDomanda: ${question}`,
  )
  return text
}

/**
 * AI Chat with tool use — can read data AND execute actions.
 * Loops until Claude returns text (not a tool call).
 */
export async function chatWithTools(
  locationId: string,
  userId: string | null,
  question: string,
  fullContext: string,
): Promise<string> {
  const { allowed } = await checkRateLimit(locationId)
  if (!allowed) throw new Error('Limite AI mensile raggiunto.')

  const client = getClient()
  const systemPrompt = `Sei un assistente AI per un CRM italiano. Hai accesso ai dati della location E puoi eseguire azioni (aggiungere tag, aggiornare campi, creare note, spostare deal).

Regole:
- Rispondi in italiano
- Quando l'utente chiede di FARE qualcosa, usa il tool appropriato
- Quando l'utente chiede INFORMAZIONI, rispondi dai dati forniti
- Dopo aver eseguito un'azione, conferma cosa hai fatto
- Non inventare dati`

  const messages: { role: 'user' | 'assistant'; content: string | unknown[] }[] = [
    { role: 'user', content: `DATI LOCATION:\n${fullContext}\n\n---\n\nRICHIESTA: ${question}` },
  ]

  let totalIn = 0
  let totalOut = 0

  // Loop: Claude may call tools, then we feed results back
  for (let i = 0; i < 5; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: messages as Anthropic.MessageParam[],
      tools: AI_TOOLS as Anthropic.Tool[],
    })

    totalIn += response.usage.input_tokens
    totalOut += response.usage.output_tokens

    // Check if Claude wants to use a tool
    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (toolUse && toolUse.type === 'tool_use') {
      // Execute the tool
      const toolResult = await executeTool(locationId, toolUse.name, toolUse.input as Record<string, string>, userId ?? undefined)

      // Feed result back to Claude
      messages.push({ role: 'assistant', content: response.content as unknown[] })
      messages.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: toolResult }] as unknown[],
      })
      continue
    }

    // No tool call — extract text response
    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => ('text' in b ? b.text : ''))
      .join('\n')

    recordUsage(locationId, userId, 'chat_with_tools', totalIn, totalOut).catch(console.error)
    return text
  }

  return 'Troppe iterazioni. Riprova con una richiesta più semplice.'
}

/**
 * Answer any question with full location data context.
 */
export async function generateInsightFull(
  locationId: string,
  userId: string | null,
  question: string,
  fullContext: string,
): Promise<string> {
  const systemPrompt = `Sei un assistente AI per un CRM italiano. Hai accesso completo a tutti i dati della location: contatti, campi personalizzati, deal, pipeline, conversazioni, appuntamenti, note, task, fatture, operatori.

Rispondi in italiano, in modo chiaro e conciso. Usa numeri, percentuali e nomi specifici. Se i dati non contengono la risposta, dillo chiaramente.

Non inventare dati. Rispondi SOLO basandoti sui dati forniti.`

  const { text } = await callClaude(
    locationId,
    userId,
    'analytics_insight_full',
    systemPrompt,
    `DATI COMPLETI DELLA LOCATION:\n\n${fullContext}\n\n---\n\nDOMANDA: ${question}`,
  )
  return text
}

/**
 * Get AI usage stats for a location.
 */
export async function getAiUsageStats(locationId: string) {
  const sb = createAdminClient()

  const [{ data: rateLimit }, { data: recentUsage }] = await Promise.all([
    sb.from('ai_rate_limits').select('*').eq('location_id', locationId).single(),
    sb.from('ai_usage')
      .select('action, tokens_in, tokens_out, created_at')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return {
    monthlyLimit: rateLimit?.monthly_limit ?? 100000,
    tokensUsed: rateLimit?.tokens_used ?? 0,
    currentMonth: rateLimit?.current_month ?? new Date().toISOString().slice(0, 7),
    recentRequests: recentUsage ?? [],
  }
}
