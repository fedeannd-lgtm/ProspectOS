import { NextRequest, NextResponse } from "next/server"
import { supabase, supabaseAdmin } from "@/lib/supabase"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Private-Network": "true",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// GET — extensión pide la lista; deriva tenant desde ?campaignId=
export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get("campaignId")

  let tenantId: string | null = null
  if (campaignId) {
    const { data: camp } = await supabaseAdmin
      .from("campaigns").select("tenant_id").eq("id", campaignId).maybeSingle()
    tenantId = camp?.tenant_id ?? null
  }

  let query = supabase
    .from("client_companies")
    .select("company_name, linkedin_url, sales_nav_id")
    .order("company_name")

  if (tenantId) query = query.eq("tenant_id", tenantId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS })

  return NextResponse.json({ companies: data ?? [] }, { headers: CORS })
}

// POST — extensión reporta los IDs que encontró
export async function POST(req: NextRequest) {
  const body = await req.json() as { results: { company_name: string; sales_nav_id: string }[]; campaignId?: string }

  if (!Array.isArray(body?.results)) {
    return NextResponse.json({ error: "results array required" }, { status: 400, headers: CORS })
  }

  let tenantId: string | null = null
  if (body.campaignId) {
    const { data: camp } = await supabaseAdmin
      .from("campaigns").select("tenant_id").eq("id", body.campaignId).maybeSingle()
    tenantId = camp?.tenant_id ?? null
  }

  for (const { company_name, sales_nav_id } of body.results) {
    if (company_name && sales_nav_id) {
      let q = supabaseAdmin
        .from("client_companies")
        .update({ sales_nav_id })
        .eq("company_name", company_name)
      if (tenantId) q = q.eq("tenant_id", tenantId)
      await q
    }
  }

  return NextResponse.json({ ok: true, updated: body.results.length }, { headers: CORS })
}
