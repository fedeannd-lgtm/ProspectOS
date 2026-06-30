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

  // Step 3: last word of first name ("Constanza" from "Maria Constanza")
  const lastFirstName = firstName.trim().split(/\s+/).slice(-1)[0]
  if (lastFirstName !== firstName.trim()) {
    try {
      const url = new URL("https://gateway.datagma.net/api/ingress/v2/find")
      url.searchParams.set("token", key)
      url.searchParams.set("fullName", `${lastFirstName} ${lastName}`.trim())
      url.searchParams.set("companyDomain", domain)
      url.searchParams.set("data", "EMAIL_FINDER_DATAGMA")
      const res = await fetch(url.toString())
      const text = await res.text()
      let json: unknown
      try { json = JSON.parse(text) } catch { json = text }
      results.step3_last_firstname = { status: res.status, body: json, fullName_used: `${lastFirstName} ${lastName}` }
    } catch (e) {
      results.step3_last_firstname = { error: String(e) }
    }
  }

  // Step 4: firstName + lastName as separate params
  try {
    const url = new URL("https://gateway.datagma.net/api/ingress/v2/find")
    url.searchParams.set("token", key)
    url.searchParams.set("firstName", lastFirstName)
    url.searchParams.set("lastName", lastName)
    url.searchParams.set("companyDomain", domain)
    url.searchParams.set("data", "EMAIL_FINDER_DATAGMA")
    const res = await fetch(url.toString())
    const text = await res.text()
    let json: unknown
    try { json = JSON.parse(text) } catch { json = text }
    results.step4_split_params = { status: res.status, body: json }
  } catch (e) {
    results.step4_split_params = { error: String(e) }
  }

  // Step 5: company name instead of domain
  const company = searchParams.get("company") ?? ""
  if (company) {
    try {
      const url = new URL("https://gateway.datagma.net/api/ingress/v2/find")
      url.searchParams.set("token", key)
      url.searchParams.set("fullName", `${lastFirstName} ${lastName}`.trim())
      url.searchParams.set("companyName", company)
      url.searchParams.set("data", "EMAIL_FINDER_DATAGMA")
      const res = await fetch(url.toString())
      const text = await res.text()
      let json: unknown
      try { json = JSON.parse(text) } catch { json = text }
      results.step5_company_name = { status: res.status, body: json }
    } catch (e) {
      results.step5_company_name = { error: String(e) }
    }
  }

  return NextResponse.json(results, { status: 200 })
}
