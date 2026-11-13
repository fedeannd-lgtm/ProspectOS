const BASE = "https://api-public.salesql.com/v1"

export async function findEmailSalesQL(
  linkedinUrl: string,
  apiKey?: string | null
): Promise<{ email: string | null; phone: string | null }> {
  const key = apiKey || process.env.SALESQL_API_KEY || ""
  if (!key) return { email: null, phone: null }
  try {
    const url = new URL(`${BASE}/persons/enrich`)
    url.searchParams.set("linkedin_url", linkedinUrl)
    const res = await fetch(url.toString(), {
      headers: { "Authorization": `Bearer ${key}` },
    })
    if (!res.ok) return { email: null, phone: null }
    const data = await res.json()
    return {
      email: data?.work_email ?? data?.email ?? null,
      phone: data?.phone ?? data?.mobile_phone ?? null,
    }
  } catch {
    return { email: null, phone: null }
  }
}
