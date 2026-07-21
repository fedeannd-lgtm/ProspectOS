const BASE = "https://api.heyreach.io/api/public/campaign"
const API_KEY = process.env.HEYREACH_API_KEY!

type HeyReachLead = {
  linkedInProfileUrl: string
  firstName?: string
  lastName?: string
  companyName?: string
  email?: string
}

export async function fetchHeyReachCampaigns(): Promise<{ id: string; name: string }[]> {
  try {
    const res = await fetch("https://api.heyreach.io/api/public/campaign/GetAllActiveCampaigns", {
      headers: { "X-API-KEY": API_KEY },
    })
    if (!res.ok) return []
    const data = await res.json()
    const list: unknown[] = Array.isArray(data) ? data : (data?.items ?? data?.campaigns ?? [])
    return list
      .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
      .map((c) => ({ id: String(c.id ?? c.campaignId ?? ""), name: String(c.name ?? "") }))
      .filter((c) => c.id && c.name)
  } catch {
    return []
  }
}

export async function addLeadsToHeyReach(
  campaignId: string,
  leads: HeyReachLead[]
): Promise<{ success: number; failed: number; error?: string }> {
  if (!leads.length) return { success: 0, failed: 0 }
  try {
    const accountLeadPairs = leads.map((l) => ({
      lead: {
        firstName: l.firstName,
        lastName: l.lastName,
        profileUrl: l.linkedInProfileUrl,
        companyName: l.companyName,
        emailAddress: l.email,
      },
    }))

    const res = await fetch(`${BASE}/AddLeadsToCampaign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/plain",
        "X-API-KEY": API_KEY,
      },
      body: JSON.stringify({
        campaignId: parseInt(campaignId, 10),
        accountLeadPairs,
        resumeFinishedCampaign: false,
        resumePausedCampaign: false,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return { success: 0, failed: leads.length, error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
    }

    // Response is a plain number: count of leads added
    const text = await res.text()
    const added = parseInt(text.trim(), 10)
    const count = isNaN(added) ? leads.length : added
    return { success: count, failed: leads.length - count }
  } catch (e) {
    return { success: 0, failed: leads.length, error: e instanceof Error ? e.message : "Error desconocido" }
  }
}
