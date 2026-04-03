export interface LeadPayload {
  clinic_id: string
  name: string
  service?: string
  phone?: string
}

export interface LeadResponse {
  success: boolean
  id: string
}

export async function postLead(payload: LeadPayload): Promise<LeadResponse> {
  const res = await fetch('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const json = await res.json()

  if (!res.ok) {
    throw new Error(json.error ?? `Request failed with status ${res.status}`)
  }

  return json as LeadResponse
}
