const BASE = "https://server.smartlead.ai/api/v1"
const API_KEY = process.env.SMARTLEAD_API_KEY!

type SmartleadLead = {
  email: string
  first_name?: string
  last_name?: string
  company_name?: string
  linkedin_profile?: string
  custom_fields?: Record<string, string>
}

export async function fetchSmartleadCampaigns(): Promise<{ id: string; name: string }[]> {
  try {
    const res = await fetch(`${BASE}/campaigns/?api_key=${API_KEY}`)
    if (!res.ok) return []
    const data = await res.json()
    const list: unknown[] = Array.isArray(data) ? data : (data?.data ?? [])
    return list
      .filter((c): c is { id: unknown; name: unknown } => !!c && typeof c === "object" && "id" in c && "name" in c)
      .map((c) => ({ id: String(c.id), name: String(c.name) }))
  } catch {
    return []
  }
}

export async function addLeadsToSmartlead(
  campaignId: string,
  leads: SmartleadLead[]
): Promise<{ success: number; failed: number; error?: string }> {
  if (!leads.length) return { success: 0, failed: 0 }
  try {
    const res = await fetch(`${BASE}/campaigns/${campaignId}/leads?api_key=${API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lead_list: leads,
        settings: {
          ignore_global_block_list: false,
          ignore_unsubscribe_list: false,
          ignore_community_bounce_list: false,
          ignore_duplicate_leads_in_other_campaign: false,
        },
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      return { success: 0, failed: leads.length, error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
    }
    const data = await res.json()
    // Smartlead returns { upload_count, already_added, invalid_emails }
    const uploaded = data?.upload_count ?? leads.length
    return { success: uploaded, failed: leads.length - uploaded }
  } catch (e) {
    return { success: 0, failed: leads.length, error: e instanceof Error ? e.message : "Error desconocido" }
  }
}
