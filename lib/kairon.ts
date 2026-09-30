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
      // No list bound yet — create one and bind it (one-time setup)
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

    // Add leads by LinkedIn URL directly to the campaign's existing list
    const items = leads.map((l) => ({ url: l.linkedInProfileUrl }))
    for (let i = 0; i < items.length; i += 500) {
      await kaironFetch(apiKey, `/lead-lists/${listId}/members`, {
        method: "POST",
        body: JSON.stringify({ items: items.slice(i, i + 500) }),
      })
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
