import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { getDatasetItems } from "@/lib/apify"
import { advanceSearchPage } from "@/app/(app)/company-search/actions"

type ApifyCompany = {
  name?: string
  companyName?: string
  domain?: string
  website?: string
  linkedInUrl?: string
  linkedin_url?: string
  url?: string
  industry?: string
  headcount?: string
  employeeCount?: string
  country?: string
  location?: string
  salesNavId?: string
  id?: string
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { jobId, datasetId } = body as { jobId: string; datasetId: string }

  if (!jobId || !datasetId) {
    return NextResponse.json({ error: "jobId y datasetId requeridos" }, { status: 400 })
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from("search_jobs")
    .select("campaign_id, campaigns(rep_name, industry)")
    .eq("id", jobId)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: "Job no encontrado" }, { status: 404 })
  }

  // Fetch companies from Apify dataset
  let companies: ApifyCompany[] = []
  try {
    companies = await getDatasetItems<ApifyCompany>(datasetId)
  } catch (e) {
    await supabaseAdmin
      .from("search_jobs")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", jobId)
    return NextResponse.json({ error: "Error fetching Apify dataset" }, { status: 502 })
  }

  const accounts = companies.map((c) => ({
    campaign_id: job.campaign_id,
    company_name: (c.name ?? c.companyName ?? "") as string,
    domain: (c.domain ?? c.website ?? "") as string,
    linkedin_url: (c.linkedInUrl ?? c.linkedin_url ?? c.url ?? "") as string,
    sales_nav_id: (c.salesNavId ?? c.id ?? "") as string,
    industry: (c.industry ?? "") as string,
    headcount_range: (c.headcount ?? c.employeeCount ?? "") as string,
    country: (c.country ?? c.location ?? "") as string,
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

  const campaign = job.campaigns as { rep_name: string; industry: string } | null
  if (campaign) {
    await advanceSearchPage(campaign.rep_name, campaign.industry, accounts.length)
  }

  return NextResponse.json({ ok: true, saved: accounts.length })
}
