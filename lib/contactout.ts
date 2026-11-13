const BASE = "https://api.contactout.com/v1"

export async function findEmailContactOut(
  linkedinUrl: string,
  apiKey?: string | null
): Promise<{ email: string | null; phone: string | null }> {
  const key = apiKey || process.env.CONTACTOUT_API_KEY || ""
  if (!key) return { email: null, phone: null }
  try {
    const url = new URL(`${BASE}/people/linkedin`)
    url.searchParams.set("profile", linkedinUrl)
    url.searchParams.set("include_phone", "true")
    const res = await fetch(url.toString(), {
      headers: { "token": key, "Content-Type": "application/json" },
    })
    if (!res.ok) return { email: null, phone: null }
    const data = await res.json()
    const profile = data?.profile ?? data
    return {
      email: profile?.work_email ?? profile?.email ?? null,
      phone: profile?.phone?.[0] ?? null,
    }
  } catch {
    return { email: null, phone: null }
  }
}
