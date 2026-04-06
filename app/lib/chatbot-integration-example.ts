/**
 * DentaFlow Chatbot Integration Example
 *
 * Copy this function into your chatbot widget script.
 * Replace DENTAFLOW_API_URL with your deployed domain.
 * Replace CLINIC_ID with the clinic's profile ID from Supabase.
 *
 * This file is not imported by the app — it is a reference for external use only.
 */

const DENTAFLOW_API_URL = 'https://your-domain.com/api/leads'

interface LeadPayload {
  clinic_id: string
  name: string
  service?: string
  phone?: string
  email?: string
}

export async function sendLeadToDentaFlow(payload: LeadPayload): Promise<void> {
  const res = await fetch(DENTAFLOW_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Failed with status ${res.status}`)
  }
}

// Usage:
//
// await sendLeadToDentaFlow({
//   clinic_id: 'your-clinic-uuid',
//   name: captured.name,
//   service: captured.service,
//   phone: captured.phone,
// })
