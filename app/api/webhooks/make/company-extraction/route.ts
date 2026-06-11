import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { advanceSearchPage } from "@/app/(app)/company-search/actions"

type ApifyCompany = {
  companyName?: string
  id?: string
  website?: string
}

// Escenario 2 de Make: recibe las empresas ya extraídas del dataset de Apify
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { jobId, companies = [] } = body as { jobId: string; companies: ApifyCompany[] }

  if (!jobId) {
    return NextResponse.json({ error: "jobId requerido" }, { status: 400 })
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from("search_jobs")
    .select("campaign_id, campaigns(rep_name, industry)")
    .eq("id", jobId)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: "Job no encontrado" }, { status: 404 })
  }

  const accounts = (companies as ApifyCompany[]).map((c) => ({
    campaign_id: job.campaign_id,
    company_name: (c.companyName ?? "") as string,
    domain: (c.website ?? "") as string,
    sales_nav_id: (c.id ?? "") as string,
  }))

  if (accounts.length > 0) {
    await supabaseAdmin.from("accounts").insert(accounts)
  }

  await supabaseAdmin
    .from("search_jobs")
    .update({
      status: "completed",
      results_count: accounts.length,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId)

  await supabaseAdmin
    .from("campaigns")
    .update({ accounts_found: accounts.length })
    .eq("id", job.campaign_id)

  const campaign = job.campaigns as unknown as { rep_name: string; industry: string } | null
  if (campaign) {
    await advanceSearchPage(campaign.rep_name, campaign.industry, accounts.length)
  }

  return NextResponse.json({ ok: true, saved: accounts.length })
}
