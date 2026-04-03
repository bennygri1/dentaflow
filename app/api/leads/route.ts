import { supabase } from '../../lib/supabase'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Handle CORS preflight
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  let body: Record<string, unknown>

  try {
    body = await request.json()
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const { clinic_id, name, service, phone, status } = body as Record<string, string>

  // Validate required fields
  if (!clinic_id || typeof clinic_id !== 'string' || !clinic_id.trim()) {
    return Response.json(
      { error: 'clinic_id is required' },
      { status: 400, headers: CORS_HEADERS }
    )
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    return Response.json(
      { error: 'name is required' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  // Confirm clinic_id refers to a real profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', clinic_id.trim())
    .single()

  if (profileError || !profile) {
    return Response.json(
      { error: 'clinic_id not found' },
      { status: 404, headers: CORS_HEADERS }
    )
  }

  // Insert the lead
  const { data, error } = await supabase.from('leads').insert({
    clinic_id: clinic_id.trim(),
    name: name.trim(),
    service: typeof service === 'string' && service.trim() ? service.trim() : null,
    phone: typeof phone === 'string' && phone.trim() ? phone.trim() : null,
    status: typeof status === 'string' && status.trim() ? status.trim() : 'new',
  }).select('id').single()

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
