import { NextRequest, NextResponse } from "next/server"
import { enrichProspect } from "@/lib/enrichment"
import { supabaseAdmin } from "@/lib/supabase"

// GET /api/test-enrichment?id=<prospect_id>
// Runs enrichment on a prospect and returns verbose results
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id param required" }, { status: 400 })

  const { data: p } = await supabaseAdmin
    .from("prospects")
    .select("id, first_name, last_name, full_name, company_name, company_domain, linkedin_url, job_title, email, email_status, accounts(linkedin_url, domain)")
    .eq("id", id)
    .single()

  if (!p) return NextResponse.json({ error: "Prospect not found" }, { status: 404 })

  const accountDomain = (p as any).accounts?.domain ?? null
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
    company_linkedin_url: (p as any).accounts?.linkedin_url ?? null,
  }

  const result = await enrichProspect(input)

  return NextResponse.json({
    prospect_input: input,
    linkedin_url_type: p.linkedin_url?.includes("ACw") ? "encoded_sales_nav" : "canonical",
    result,
  })
}
