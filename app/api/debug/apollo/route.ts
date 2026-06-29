export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { first_name, last_name, company_name, company_domain, linkedin_url } = body

    const apiKey = process.env.APOLLO_API_KEY
    if (!apiKey) {
      return Response.json({ error: "APOLLO_API_KEY not set" }, { status: 400 })
    }

    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": apiKey,
    }

    const results: Record<string, unknown> = {}

    // Step 1: people/match with all fields
    const r1 = await fetch("https://api.apollo.io/v1/people/match", {
      method: "POST",
      headers,
      body: JSON.stringify({
        api_key: apiKey,
        reveal_personal_emails: true,
        first_name,
        last_name,
        organization_name: company_name || undefined,
        domain: company_domain || undefined,
        linkedin_url: linkedin_url || undefined,
      }),
    })
    results.step1_people_match = { status: r1.status, body: await r1.json() }

    // Step 2: people/match with LinkedIn URL only
    if (linkedin_url) {
      const r2 = await fetch("https://api.apollo.io/v1/people/match", {
        method: "POST",
        headers,
        body: JSON.stringify({ api_key: apiKey, reveal_personal_emails: true, linkedin_url }),
      })
      results.step2_url_only = { status: r2.status, body: await r2.json() }
    }

    // Step 3: mixed_people/search by domain
    if (company_domain) {
      const r3 = await fetch("https://api.apollo.io/v1/mixed_people/search", {
        method: "POST",
        headers,
        body: JSON.stringify({
          api_key: apiKey,
          q_organization_domains: [company_domain],
          per_page: 25,
        }),
      })
      const d3 = await r3.json()
      // Show only first 5 people to keep response small
      if (d3?.people) d3.people = d3.people.slice(0, 5).map((p: Record<string, unknown>) => ({
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
        linkedin_url: p.linkedin_url,
      }))
      results.step3_mixed_search = { status: r3.status, body: d3 }
    }

    return Response.json({
      key_prefix: apiKey.slice(0, 8) + "...",
      inputs: { first_name, last_name, company_name, company_domain, linkedin_url },
      results,
    })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
