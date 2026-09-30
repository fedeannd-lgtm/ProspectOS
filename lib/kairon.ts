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
    // Step 1: create a temporary lead list
    const list = await kaironFetch(apiKey, "/lead-lists", {
      method: "POST",
      body: JSON.stringify({ name: `ProspectOS-${campaignId}-${Date.now()}` }),
    }) as { id?: string } | null

    const listId = list?.id
    if (!listId) throw new Error("No se pudo crear la lead list en Kairon")

    // Step 2: add leads by LinkedIn URL (up to 500 per batch)
    const items = leads.map((l) => ({ url: l.linkedInProfileUrl }))
    for (let i = 0; i < items.length; i += 500) {
      await kaironFetch(apiKey, `/lead-lists/${listId}/members`, {
        method: "POST",
        body: JSON.stringify({ items: items.slice(i, i + 500) }),
      })
    }

    // Kairon resolves LinkedIn URLs asynchronously — wait before binding
    // so the list has members at snapshot time
    await new Promise(r => setTimeout(r, 8000))

    // Check list status to detect silent failures
    const listStatus = await kaironFetch(apiKey, `/lead-lists/${listId}`).catch(() => null) as any
    const resolvedCount = listStatus?.membersCount ?? listStatus?.totalCount ?? listStatus?.count ?? 0
    if (resolvedCount === 0) {
      // Still 0 after wait — include the URLs sent for debugging
      const urlSample = items.slice(0, 3).map(i => i.url).join(", ")
      throw new Error(`Lista creada pero sin miembros luego de 8s. URLs enviadas: ${urlSample}`)
    }

    // Step 3: bind the list to the campaign
    await kaironFetch(apiKey, `/campaigns/${campaignId}/lists`, {
      method: "POST",
      body: JSON.stringify({ leadListId: listId }),
    })

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
