import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const firstName = searchParams.get("first_name") ?? "Maria Constanza"
  const lastName = searchParams.get("last_name") ?? "Dristas"
  const domain = searchParams.get("domain") ?? "arauco.com"
  const linkedinUrl = searchParams.get("linkedin_url") ?? ""

  const key = process.env.DATAGMA_API_KEY
  if (!key) return NextResponse.json({ error: "DATAGMA_API_KEY no configurada" }, { status: 500 })

  const results: Record<string, unknown> = { key_prefix: key.slice(0, 6) + "..." }

  // Step 1: LinkedIn URL lookup
  if (linkedinUrl) {
    try {
      const url = new URL("https://gateway.datagma.net/api/ingress/v2/find")
      url.searchParams.set("token", key)
      url.searchParams.set("uid", linkedinUrl)
      url.searchParams.set("data", "EMAIL_FINDER_DATAGMA")
      const res = await fetch(url.toString())
      const text = await res.text()
      let json: unknown
      try { json = JSON.parse(text) } catch { json = text }
      results.step1_linkedin = { status: res.status, body: json }
    } catch (e) {
      results.step1_linkedin = { error: String(e) }
    }
  } else {
    results.step1_linkedin = "skipped (no linkedin_url param)"
  }

  // Step 2: name + domain
  try {
    const url = new URL("https://gateway.datagma.net/api/ingress/v2/find")
    url.searchParams.set("token", key)
    url.searchParams.set("fullName", `${firstName} ${lastName}`.trim())
    url.searchParams.set("companyDomain", domain)
    url.searchParams.set("data", "EMAIL_FINDER_DATAGMA")
    const res = await fetch(url.toString())
    const text = await res.text()
    let json: unknown
    try { json = JSON.parse(text) } catch { json = text }
    results.step2_name_domain = { status: res.status, body: json }
  } catch (e) {
    results.step2_name_domain = { error: String(e) }
  }

  // Step 3: firstName only + domain (some providers work better with split name)
  try {
    const url = new URL("https://gateway.datagma.net/api/ingress/v2/find")
    url.searchParams.set("token", key)
    url.searchParams.set("firstName", firstName)
    url.searchParams.set("lastName", lastName)
    url.searchParams.set("companyDomain", domain)
    url.searchParams.set("data", "EMAIL_FINDER_DATAGMA")
    const res = await fetch(url.toString())
    const text = await res.text()
    let json: unknown
    try { json = JSON.parse(text) } catch { json = text }
    results.step3_split_name = { status: res.status, body: json }
  } catch (e) {
    results.step3_split_name = { error: String(e) }
  }

  return NextResponse.json(results, { status: 200 })
}
