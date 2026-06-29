import { canonicalLinkedInUrl } from "@/lib/linkedin"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { first_name, last_name, domain, linkedin_url } = body

    const apiKey = process.env.FINDYMAIL_API_KEY
    if (!apiKey) return Response.json({ error: "FINDYMAIL_API_KEY no configurada" }, { status: 400 })

    const results: Record<string, unknown> = {
      inputs: { first_name, last_name, domain, linkedin_url },
      key_prefix: apiKey.slice(0, 6) + "...",
    }

    const canonical = canonicalLinkedInUrl(linkedin_url ?? "")
    results.canonical_url = canonical ?? "(URL codificada — lookup por LinkedIn desactivado)"

    // Step 1: LinkedIn URL lookup
    if (canonical) {
      const r1 = await fetch("https://app.findymail.com/api/search/linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ linkedin_url: canonical }),
      })
      results.step1_linkedin = { status: r1.status, body: await r1.json() }
    } else {
      results.step1_linkedin = "skipped — no canonical URL"
    }

    // Step 2: Name + domain lookup
    if (domain) {
      const r2 = await fetch("https://app.findymail.com/api/search/name", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ name: `${first_name} ${last_name}`.trim(), domain }),
      })
      results.step2_name_domain = { status: r2.status, body: await r2.json() }
    } else {
      results.step2_name_domain = "skipped — no domain"
    }

    return Response.json(results)
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
