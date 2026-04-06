import { supabase } from '../../lib/supabase'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────
// Simple in-memory store: ip → { count, resetAt }
// Limits each IP to MAX_REQUESTS submissions per WINDOW_MS.
// Resets on server restart — good enough for a single-process MVP.

const WINDOW_MS    = 60_000  // 1 minute
const MAX_REQUESTS = 5

interface RateEntry { count: number; resetAt: number }
const rateStore = new Map<string, RateEntry>()

function isRateLimited(ip: string): boolean {
  const now  = Date.now()
  const entry = rateStore.get(ip)

  if (!entry || now > entry.resetAt) {
    rateStore.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }

  if (entry.count >= MAX_REQUESTS) return true

  entry.count++
  return false
}

// Prune stale entries periodically so the Map doesn't grow forever
function pruneStore() {
  const now = Date.now()
  for (const [ip, entry] of rateStore) {
    if (now > entry.resetAt) rateStore.delete(ip)
  }
}
setInterval(pruneStore, WINDOW_MS * 5)

// ─── Validation helpers ───────────────────────────────────────────────────────

// Accepts international formats: +44 7700 900000, (555) 123-4567, 07700900000, etc.
// Rejects anything that isn't plausibly a phone number.
const PHONE_RE = /^[+]?[\d\s\-().]{7,20}$/

// Basic email sanity check — not RFC-complete, but catches obvious junk
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// ─── CORS preflight ───────────────────────────────────────────────────────────

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

// ─── POST /api/leads ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // Derive client IP (works on Vercel / standard proxies)
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  if (isRateLimited(ip)) {
    return Response.json(
      { error: 'Too many requests. Please wait a minute and try again.' },
      { status: 429, headers: { ...CORS_HEADERS, 'Retry-After': '60' } }
    )
  }

  // ── Parse body ──
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { error: 'Invalid JSON body.' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  // ── Extract and trim fields ──
  const raw = body as Record<string, unknown>

  const clinic_id = typeof raw.clinic_id === 'string' ? raw.clinic_id.trim() : ''
  const name      = typeof raw.name      === 'string' ? raw.name.trim()      : ''
  const service   = typeof raw.service   === 'string' ? raw.service.trim()   : ''
  const phone     = typeof raw.phone     === 'string' ? raw.phone.trim()     : ''
  const email     = typeof raw.email     === 'string' ? raw.email.trim()     : ''
  // External submissions are always 'new' — callers cannot promote their own lead status
  const status    = 'new'
  void raw.status // acknowledged but intentionally ignored

  // ── Required field validation ──
  if (!clinic_id) {
    return Response.json(
      { error: 'clinic_id is required.' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  if (!name) {
    return Response.json(
      { error: 'Name is required.' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  if (name.length > 100) {
    return Response.json(
      { error: 'Name must be 100 characters or fewer.' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  // ── Optional field validation ──
  if (phone && !PHONE_RE.test(phone)) {
    return Response.json(
      { error: 'Phone number format is not valid.' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  if (phone && phone.length > 30) {
    return Response.json(
      { error: 'Phone number is too long.' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  if (email && !EMAIL_RE.test(email)) {
    return Response.json(
      { error: 'Email address format is not valid.' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  if (email && email.length > 254) {
    return Response.json(
      { error: 'Email address is too long.' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  if (service && service.length > 200) {
    return Response.json(
      { error: 'Service description is too long.' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  // ── Confirm clinic exists ──
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', clinic_id)
    .single()

  if (profileError || !profile) {
    return Response.json(
      { error: 'clinic_id not found.' },
      { status: 404, headers: CORS_HEADERS }
    )
  }

  // ── Insert lead ──
  const { data, error } = await supabase
    .from('leads')
    .insert({
      clinic_id,
      name,
      service:  service || null,
      phone:    phone   || null,
      status:   status  || 'new',
    })
    .select('id')
    .single()

  if (error) {
    return Response.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS }
    )
  }

  return Response.json(
    { success: true, id: data.id },
    { status: 201, headers: CORS_HEADERS }
  )
}
