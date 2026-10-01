const BASE_URL = "https://app.heykairon.com/api"

async function kaironFetch(apiKey: string, path: string, options: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "x-api-key": apiKey,
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`HTTP ${res.status}: ${body}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export type KaironLead = {
  linkedInProfileUrl: string
  firstName?: string
  lastName?: string
  companyName?: string
  position?: string
  email?: string
  customUserFields?: { name: string; value: string }[]
}

export async function fetchKaironCampaigns(apiKey: string): Promise<{ id: string; name: string }[]> {
  try {
    const data = await kaironFetch(apiKey, "/campaigns?limit=100&status=active,draft,paused") as any
    const list: unknown[] = data?.items ?? data?.campaigns ?? (Array.isArray(data) ? data : [])
    return list
      .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
      .map((c) => ({ id: String(c.id ?? ""), name: String(c.name ?? "") }))
      .filter((c) => c.id && c.name)
  } catch {
    return []
  }
}

export async function addLeadsToKairon(
  apiKey: string,
  campaignId: string,
  leads: KaironLead[]
): Promise<{ success: number; failed: number; error?: string }> {
  if (!leads.length) return { success: 0, failed: 0 }

  try {
    // Get the list already bound to this campaign (avoids creating new lists)
    let listId: string | null = null
    const bound = await kaironFetch(apiKey, `/campaigns/${campaignId}/lists`).catch(() => null) as any
    const firstBound = bound?.items?.[0] ?? bound?.leadLists?.[0] ?? (Array.isArray(bound) ? bound[0] : null)
    if (firstBound?.id) {
      listId = String(firstBound.id)
    } else if (firstBound?.leadListId) {
      listId = String(firstBound.leadListId)
    }

    if (!listId) {
      const newList = await kaironFetch(apiKey, "/lead-lists", {
        method: "POST",
        body: JSON.stringify({ name: `ProspectOS - ${campaignId}` }),
      }) as { id?: string } | null
      listId = newList?.id ?? null
      if (!listId) throw new Error("No se pudo crear la lead list en Kairon")
      await kaironFetch(apiKey, `/campaigns/${campaignId}/lists`, {
        method: "POST",
        body: JSON.stringify({ leadListId: listId }),
      })
    }

    // Step 1: Add leads — use snapshot format when we have profile data so Kairon
    // doesn't need to scrape LinkedIn to populate the PERSON field
    const items = leads.map((l) => {
      const publicIdentifier = l.linkedInProfileUrl.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1]
      const name = [l.firstName, l.lastName].filter(Boolean).join(" ") || undefined
      if (publicIdentifier && (name || l.companyName || l.position)) {
        return {
          snapshot: {
            providerId: publicIdentifier,
            publicIdentifier,
            profileUrl: l.linkedInProfileUrl,
            ...(name ? { name } : {}),
            ...(l.position ? { headline: l.position } : {}),
            ...(l.companyName ? { company: l.companyName } : {}),
          },
        }
      }
      return { url: l.linkedInProfileUrl }
    })
    for (let i = 0; i < items.length; i += 500) {
      await kaironFetch(apiKey, `/lead-lists/${listId}/members`, {
        method: "POST",
        body: JSON.stringify({ items: items.slice(i, i + 500) }),
      })
    }

    // Step 2: Look up leadIds by URL, then set column values with prospect data
    const leadsWithData = leads.filter(
      (l) => l.firstName || l.lastName || l.companyName || l.position || l.email || l.customUserFields?.length
    )
    if (leadsWithData.length > 0) {
      // Fetch in batches of 100 (API limit)
      for (let i = 0; i < leadsWithData.length; i += 100) {
        const batch = leadsWithData.slice(i, i + 100)
        const urlParams = batch.map((l) => `keys[]=${encodeURIComponent(l.linkedInProfileUrl)}`).join("&")
        try {
          const members = await kaironFetch(apiKey, `/lead-lists/${listId}/members/by-keys?${urlParams}`) as any
          const memberList: any[] = members?.items ?? members?.members ?? (Array.isArray(members) ? members : [])
          for (const member of memberList) {
            const leadId: string | null = member?.leadId ?? member?.id ?? null
            if (!leadId) continue
            // Match back to our lead by URL
            const memberUrl: string = member?.lead?.profileUrl ?? member?.profileUrl ?? member?.url ?? ""
            const lead = batch.find((l) =>
              memberUrl && l.linkedInProfileUrl && memberUrl.includes(
                l.linkedInProfileUrl.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "").replace(/\/$/, "")
              )
            )
            if (!lead) continue
            // Build column values from available fields
            const values: Record<string, string> = {}
            if (lead.firstName) values["first_name"] = lead.firstName
            if (lead.lastName) values["last_name"] = lead.lastName
            if (lead.companyName) values["company"] = lead.companyName
            if (lead.position) values["position"] = lead.position
            if (lead.email) values["email"] = lead.email
            for (const f of lead.customUserFields ?? []) {
              if (f.name && f.value) values[f.name] = f.value
            }
            if (Object.keys(values).length > 0) {
              await kaironFetch(apiKey, `/lead-lists/${listId}/members/${leadId}/values`, {
                method: "PUT",
                body: JSON.stringify({ values }),
              }).catch(() => { /* non-fatal: column may not exist yet */ })
            }
          }
        } catch { /* non-fatal: column values are best-effort */ }
      }
    }

    return { success: leads.length, failed: 0 }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido"
    return { success: 0, failed: leads.length, error: msg }
  }
}

export async function testKaironConnection(apiKey: string): Promise<{ ok: boolean; detail: string }> {
  try {
    await kaironFetch(apiKey, "/campaigns?limit=1")
    return { ok: true, detail: "Conexión exitosa" }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido"
    return { ok: false, detail: msg }
  }
}
