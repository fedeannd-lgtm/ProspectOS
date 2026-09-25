const MCP_URL = "https://app.heykairon.com/mcp"

type McpResult = { content?: { type: string; text: string }[] } | null

async function kaironCall(apiKey: string, toolName: string, args: Record<string, unknown>): Promise<McpResult> {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  const json = await res.json()
  if (json.error) throw new Error(json.error.message ?? "Kairon error")
  return json.result ?? null
}

function parseResult(result: McpResult): unknown {
  const text = result?.content?.find((c) => c.type === "text")?.text
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
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
    const result = await kaironCall(apiKey, "campaign_list", { status: "active" })
    const data = parseResult(result)
    const list: unknown[] = (data as any)?.campaigns ?? (Array.isArray(data) ? data : [])
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
      await kaironCall(apiKey, "campaign_lead_start", {
        campaignId,
        profileUrl: lead.linkedInProfileUrl,
        firstName: lead.firstName,
        lastName: lead.lastName,
        companyName: lead.companyName,
        position: lead.position,
      })
      success++
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Error desconocido")
    }
  }

  const failed = leads.length - success
  return { success, failed, error: errors.length > 0 ? errors[0] : undefined }
}
