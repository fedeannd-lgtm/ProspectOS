"use server"

import { revalidatePath } from "next/cache"
import { supabase, supabaseAdmin } from "@/lib/supabase"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

export async function getCampaigns() {
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, week_label, rep_name, industry, status")
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function getCompanySearchJobs() {
  const { data, error } = await supabase
    .from("search_jobs")
    .select("*, campaigns(week_label, rep_name, industry)")
    .eq("job_type", "company_search")
    .order("created_at", { ascending: false })
    .limit(20)
  if (error) throw new Error(error.message)
  return data
}

export async function getSearchConfig(repName: string, industry: string) {
  const { data: savedUrl } = await supabase
    .from("saved_urls")
    .select("url")
    .eq("rep_name", repName)
    .eq("industry", industry)
    .eq("url_type", "company_search")
    .order("created_at", { ascending: false })
    .maybeSingle()

  if (!savedUrl) return null
  return { base_url: savedUrl.url }
}

export async function triggerCompanySearch(
  campaignId: string,
  repName: string,
  industry: string,
  maxResults: number
): Promise<{ jobId: string; extensionUrl: string } | { error: string }> {
  try {
    const config = await getSearchConfig(repName, industry)
    if (!config) return { error: "No hay URL configurada para este rep+industria. Configurala en Settings." }

    const { data: job, error } = await supabase
      .from("search_jobs")
      .insert({
        campaign_id: campaignId,
        job_type: "company_search",
        sales_nav_url: config.base_url,
        status: "pending",
        max_results: maxResults,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    const callbackUrl = encodeURIComponent(`${APP_URL}/api/extension/results`)
    const hashSep = config.base_url.includes('#') ? '&' : '#'
    const extensionUrl = `${config.base_url}${hashSep}_mode=company_scrape&_job=${job.id}&_max=${maxResults}&_cb=${callbackUrl}`

    revalidatePath("/company-search")
    return { jobId: job.id, extensionUrl }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error al iniciar la búsqueda" }
  }
}

// No-op: pagination is handled entirely by the extension in a single session
export async function advanceSearchPage(
  _repName: string,
  _industry: string,
  _resultsCount: number
) {}

export async function deleteSearchJobs(ids: string[]): Promise<void> {
  if (!ids.length) return
  const { error } = await supabaseAdmin.from("search_jobs").delete().in("id", ids)
  if (error) throw new Error(error.message)
  revalidatePath("/company-search")
}

export async function getJobStatus(jobId: string) {
  const { data, error } = await supabase
    .from("search_jobs")
    .select("status, results_count, estimated_ready_at")
    .eq("id", jobId)
    .single()
  if (error) return null
  return data
}
