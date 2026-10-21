import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Private-Network": "true",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/**
 * GET /api/extension/auto-account-list?campaignId=XXX
 *
 * Returns the scraped company IDs + suggested list name for an auto campaign.
 * Called by the extension in create_account_list mode before creating the Sales Nav list.
 */
export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get("campaignId")
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId requerido" }, { status: 400, headers: CORS })
  }

  // Fetch campaign to build list name
  const { data: campaign, error: campErr } = await supabaseAdmin
    .from("campaigns")
    .select("week_label, rep_name, industry")
    .eq("id", campaignId)
    .single()

  if (campErr || !campaign) {
    return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404, headers: CORS })
  }

  const listName = `${campaign.week_label} - ${campaign.industry}`
  const mode = req.nextUrl.searchParams.get("mode")

  if (mode === "names") {
    // Claude Search mode: return company names + linkedin_urls (no Sales Nav IDs yet)
    const { data: accounts, error: accErr } = await supabaseAdmin
      .from("accounts")
      .select("company_name, linkedin_url")
      .eq("campaign_id", campaignId)
      .is("sales_nav_id", null)

    if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500, headers: CORS })

    const companies = (accounts ?? []).map((a) => ({
      company_name: a.company_name,
      linkedin_url: a.linkedin_url ?? null,
    }))

    return NextResponse.json({ listName, companies, campaignId }, { headers: CORS })
  }

  // Default mode: return Sales Nav IDs for accounts already resolved
  const { data: accounts, error: accErr } = await supabaseAdmin
    .from("accounts")
    .select("sales_nav_id, company_name")
    .eq("campaign_id", campaignId)
    .not("sales_nav_id", "is", null)

  if (accErr) {
    return NextResponse.json({ error: accErr.message }, { status: 500, headers: CORS })
  }

  const companyIds = (accounts ?? [])
    .map((a) => a.sales_nav_id)
    .filter((id): id is string => Boolean(id))

  return NextResponse.json(
    { listName, companyIds, campaignId },
    { headers: CORS }
  )
}
