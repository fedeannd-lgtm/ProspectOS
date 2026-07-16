const BASE = "https://api.heyreach.io/api/public/v2"
const API_KEY = process.env.HEYREACH_API_KEY!

type HeyReachLead = {
  linkedInProfileUrl: string
  firstName?: string
  lastName?: string
  companyName?: string
  email?: string
}

export async function addLeadsToHeyReach(
  campaignId: string,
  leads: HeyReachLead[]
): Promise<{ success: number; failed: number; error?: string }> {
  if (!leads.length) return { success: 0, failed: 0 }
  try {
    const res = await fetch(`${BASE}/campaign/AddLeadsToACampaign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": API_KEY,
      },
      body: JSON.stringify({ campaignId, leadsWithLinkedInUrls: leads }),
    })
    if (!res.ok) {
      const text = await res.text()
      return { success: 0, failed: leads.length, error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
    }
    const data = await res.json()
    // HeyReach returns { addedCount, alreadyInCampaignCount, invalidCount }
    const added = data?.addedCount ?? leads.length
    return { success: added, failed: leads.length - added }
  } catch (e) {
    return { success: 0, failed: leads.length, error: e instanceof Error ? e.message : "Error desconocido" }
  }
}
