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
  let success = 0
  const errors: string[] = []

  for (const lead of leads) {
    try {
      // Step 1: create or find the lead
      const created = await kaironFetch(apiKey, "/leads", {
        method: "POST",
        body: JSON.stringify({
          linkedInUrl: lead.linkedInProfileUrl,
          firstName: lead.firstName,
          lastName: lead.lastName,
          companyName: lead.companyName,
          position: lead.position,
        }),
      }) as { id?: string } | null

      const leadId = created?.id
      if (!leadId) throw new Error("Lead creado pero sin ID en respuesta")

      // Step 2: enroll in campaign
      await kaironFetch(apiKey, `/campaigns/${campaignId}/leads/${leadId}/start`, {
        method: "POST",
        body: JSON.stringify({}),
      })

      success++
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Error desconocido")
    }
  }

  const failed = leads.length - success
  return { success, failed, error: errors.length > 0 ? errors[0] : undefined }
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
