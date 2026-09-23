import { NextRequest, NextResponse } from "next/server"
import { enrichProspect } from "@/lib/enrichment"
import { supabaseAdmin } from "@/lib/supabase"

// GET /api/test-enrichment
// Picks the first not_found prospect and runs enrichment with verbose output
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")

  let prospect
  if (id) {
    const { data } = await supabaseAdmin
      .from("prospects")
      .select("id, first_name, last_name, full_name, company_name, company_domain, linkedin_url, job_title, email, email_status, accounts(linkedin_url, domain)")
      .eq("id", id)
      .single()
    prospect = data
  } else {
    const { data } = await supabaseAdmin
      .from("prospects")
      .select("id, first_name, last_name, full_name, company_name, company_domain, linkedin_url, job_title, email, email_status, accounts(linkedin_url, domain)")
      .eq("status", "not_found")
      .limit(1)
      .single()
    prospect = data
  }

  if (!prospect) return NextResponse.json({ error: "No prospect found" }, { status: 404 })

  const p = prospect as any
  const accountDomain = p.accounts?.domain ?? null
  const cleanAccountDomain = accountDomain
    ? accountDomain.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "").toLowerCase()
    : null
  const effectiveDomain = p.company_domain || cleanAccountDomain

  const input = {
    first_name: p.first_name ?? "",
    last_name: p.last_name ?? "",
    full_name: p.full_name ?? "",
    company_name: p.company_name ?? "",
    company_domain: effectiveDomain,
    linkedin_url: p.linkedin_url ?? "",
    company_linkedin_url: p.accounts?.linkedin_url ?? null,
  }

  const result = await enrichProspect(input)

  return NextResponse.json({
    prospect_id: p.id,
    prospect_input: input,
    linkedin_url_type: p.linkedin_url?.includes("ACw") ? "encoded_sales_nav" : "canonical",
    result,
  })
}
