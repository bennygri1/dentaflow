import { supabase } from '../../lib/supabase'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// ─── Rate limiter (shared pattern with /api/leads) ────────────────────────────

const WINDOW_MS    = 60_000
const MAX_REQUESTS = 30   // more generous — conversations are multi-turn

interface RateEntry { count: number; resetAt: number }
const rateStore = new Map<string, RateEntry>()

function isRateLimited(ip: string): boolean {
  const now   = Date.now()
  const entry = rateStore.get(ip)
  if (!entry || now > entry.resetAt) {
    rateStore.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  if (entry.count >= MAX_REQUESTS) return true
  entry.count++
  return false
}
setInterval(() => {
  const now = Date.now()
  for (const [ip, e] of rateStore) if (now > e.resetAt) rateStore.delete(ip)
}, WINDOW_MS * 5)

// ─── Anthropic types (minimal) ────────────────────────────────────────────────

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

interface AnthropicContentBlock {
  type: 'text' | 'tool_use' | 'tool_result'
  id?: string
  name?: string
  input?: Record<string, string>
  tool_use_id?: string
  text?: string
  content?: string
}

interface AnthropicResponse {
  id: string
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence'
  content: AnthropicContentBlock[]
  usage: { input_tokens: number; output_tokens: number }
}

// ─── Anthropic API call ───────────────────────────────────────────────────────

const ANTHROPIC_MODEL = 'claude-haiku-4-5'
const ANTHROPIC_URL   = 'https://api.anthropic.com/v1/messages'

const SAVE_LEAD_TOOL = {
  name: 'save_lead',
  description:
    'Save a patient lead once you have their name and at least one contact method ' +
    '(phone or email). Call this tool exactly once per conversation — do not call it again.',
  input_schema: {
    type: 'object',
    properties: {
      name:    { type: 'string', description: "Patient's full name" },
      phone:   { type: 'string', description: 'Phone number, if provided' },
      email:   { type: 'string', description: 'Email address, if provided' },
      service: { type: 'string', description: 'Service they are interested in, if mentioned' },
    },
    required: ['name'],
  },
}

async function callAnthropic(
  messages: AnthropicMessage[],
  system: string
): Promise<AnthropicResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.')

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      ANTHROPIC_MODEL,
      max_tokens: 400,
      system,
      tools:    [SAVE_LEAD_TOOL],
      messages,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `Anthropic ${res.status}`)
  }

  return res.json() as Promise<AnthropicResponse>
}

function buildSystemPrompt(clinicName: string): string {
  return [
    `You are a warm, friendly dental receptionist assistant for ${clinicName || 'our dental clinic'}.`,
    'Your role: help patients book appointments, answer questions about dental services, and collect their contact details.',
    '',
    'Guidelines:',
    '- Keep every reply to 2–3 sentences maximum. This is a chat widget, not an email.',
    '- Be conversational and friendly, not clinical or formal.',
    '- Common services: general check-up, teeth cleaning, whitening, Invisalign, implants, fillings, extractions, root canal, emergency appointment.',
    '- If asked something unrelated to dentistry, gently redirect.',
    '',
    'Lead capture:',
    '- Naturally work toward collecting the patient\'s name and either their phone number or email.',
    '- Do NOT ask for both phone and email — one contact method is enough.',
    '- Once you have a name + contact, call the save_lead tool. Call it exactly once.',
    '- After saving, confirm their enquiry warmly and say the team will be in touch soon.',
  ].join('\n')
}

// ─── CORS preflight ───────────────────────────────────────────────────────────

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

// ─── POST /api/chat ───────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  if (isRateLimited(ip)) {
    return Response.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429, headers: { ...CORS_HEADERS, 'Retry-After': '60' } }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON.' }, { status: 400, headers: CORS_HEADERS })
  }

  const clinic_id   = typeof body.clinic_id   === 'string' ? body.clinic_id.trim()   : ''
  const clinic_name = typeof body.clinic_name === 'string' ? body.clinic_name.trim() : ''
  const messages    = Array.isArray(body.messages) ? (body.messages as AnthropicMessage[]) : []

  if (!clinic_id) {
    return Response.json({ error: 'clinic_id is required.' }, { status: 400, headers: CORS_HEADERS })
  }
  if (messages.length === 0) {
    return Response.json({ error: 'messages array is required.' }, { status: 400, headers: CORS_HEADERS })
  }

  // Validate the clinic exists
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', clinic_id)
    .single()

  if (profileError || !profile) {
    return Response.json({ error: 'clinic_id not found.' }, { status: 404, headers: CORS_HEADERS })
  }

  const system = buildSystemPrompt(clinic_name)

  try {
    // ── First Anthropic call ──
    const response1 = await callAnthropic(messages, system)

    // ── Handle tool use ──
    if (response1.stop_reason === 'tool_use') {
      const toolBlock = response1.content.find(
        (b): b is AnthropicContentBlock & { type: 'tool_use'; id: string; name: string; input: Record<string, string> } =>
          b.type === 'tool_use' && b.name === 'save_lead'
      )

      if (toolBlock) {
        const { name, phone, email, service } = toolBlock.input

        // Save the lead to Supabase
        const { data: lead, error: leadError } = await supabase
          .from('leads')
          .insert({
            clinic_id,
            name:    (name    || '').trim() || 'Unknown',
            phone:   phone    ? phone.trim()   : null,
            service: service  ? service.trim() : null,
            status:  'new',
          })
          .select('id')
          .single()

        const toolResultContent = leadError
          ? 'There was an error saving the lead.'
          : 'Lead saved successfully.'

        // ── Second call with tool result so Claude can respond ──
        const response2 = await callAnthropic(
          [
            ...messages,
            { role: 'assistant', content: response1.content },
            {
              role: 'user',
              content: [
                {
                  type:        'tool_result',
                  tool_use_id: toolBlock.id,
                  content:     toolResultContent,
                },
              ],
            },
          ],
          system
        )

        const text = response2.content.find(b => b.type === 'text')?.text ?? ''
        return Response.json(
          { message: text, leadSaved: !leadError, leadId: lead?.id ?? null },
          { status: 200, headers: CORS_HEADERS }
        )
      }
    }

    // ── Normal text response ──
    const text = response1.content.find(b => b.type === 'text')?.text ?? ''
    return Response.json(
      { message: text, leadSaved: false },
      { status: 200, headers: CORS_HEADERS }
    )

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Something went wrong.'
    return Response.json({ error: msg }, { status: 500, headers: CORS_HEADERS })
  }
}
