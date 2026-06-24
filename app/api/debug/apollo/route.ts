export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { first_name, last_name, company_name, company_domain, linkedin_url } = body

    const apiKey = process.env.APOLLO_API_KEY
    if (!apiKey) {
      return Response.json({ error: "APOLLO_API_KEY not set in environment" }, { status: 400 })
    }

    const payload = {
      api_key: apiKey,
      first_name,
      last_name,
      organization_name: company_name || undefined,
      domain: company_domain || undefined,
      linkedin_url: linkedin_url || undefined,
      reveal_personal_emails: true,
    }

    const res = await fetch("https://api.apollo.io/v1/people/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(payload),
    })

    const text = await res.text()
    let data: unknown
    try { data = JSON.parse(text) } catch { data = text }

    return Response.json({
      apollo_status: res.status,
      key_prefix: apiKey.slice(0, 8) + "...",
      payload_sent: { ...payload, api_key: "[redacted]" },
      response: data,
    })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
