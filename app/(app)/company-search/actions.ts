"use server"

import { revalidatePath } from "next/cache"
import { supabase, supabaseAdmin } from "@/lib/supabase"

const MAKE_WEBHOOK = process.env.MAKE_COMPANY_SEARCH_WEBHOOK_URL!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

// 50 empresas ≈ 20 min → 0.4 min por empresa
function estimatedMinutes(maxResults: number) {
  return Math.ceil((maxResults / 50) * 20)
}

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
  const { data, error } = await supabase
    .from("search_configs")
    .select("base_url, next_page")
    .eq("rep_name", repName)
    .eq("industry", industry)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as { base_url: string; next_page: number } | null
}

export async function upsertSearchConfig(
  repName: string,
  industry: string,
  baseUrl: string,
  nextPage: number
) {
  const { error } = await supabase
    .from("search_configs")
    .upsert(
      { rep_name: repName, industry, base_url: baseUrl, next_page: nextPage, updated_at: new Date().toISOString() },
      { onConflict: "rep_name,industry" }
    )
  if (error) throw new Error(error.message)
  revalidatePath("/company-search")
}

export async function triggerCompanySearch(
  campaignId: string,
  repName: string,
  industry: string,
  maxResults: number
) {
  if (!MAKE_WEBHOOK) throw new Error("MAKE_COMPANY_SEARCH_WEBHOOK_URL no configurado en .env.local")

  const config = await getSearchConfig(repName, industry)
  if (!config) throw new Error("No hay URL configurada para este rep+industria")

  const estimatedReadyAt = new Date(Date.now() + estimatedMinutes(maxResults) * 60 * 1000).toISOString()

  const { data: job, error } = await supabase
    .from("search_jobs")
    .insert({
      campaign_id: campaignId,
      job_type: "company_search",
      sales_nav_url: config.base_url,
      status: "running",
      max_results: maxResults,
      estimated_ready_at: estimatedReadyAt,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  const callbackUrl = `${APP_URL}/api/webhooks/make/company-search`
  await fetch(MAKE_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: job.id,
      campaignId,
      salesNavUrl: config.base_url,
      page: config.next_page,
      maxResults,
      callbackUrl,
    }),
  })

  revalidatePath("/company-search")
  return { jobId: job.id, estimatedReadyAt }
}

export async function advanceSearchPage(
  repName: string,
  industry: string,
  resultsCount: number
) {
  const config = await getSearchConfig(repName, industry)
  if (!config) return

  const pagesConsumed = Math.max(1, Math.ceil(resultsCount / 25))
  const { error } = await supabaseAdmin
    .from("search_configs")
    .update({ next_page: config.next_page + pagesConsumed, updated_at: new Date().toISOString() })
    .eq("rep_name", repName)
    .eq("industry", industry)
  if (error) throw new Error(error.message)
}

export async function triggerExtraction(jobId: string, datasetId: string) {
  const MAKE_EXTRACTION_WEBHOOK = process.env.MAKE_COMPANY_EXTRACTION_WEBHOOK_URL
  if (!MAKE_EXTRACTION_WEBHOOK) throw new Error("MAKE_COMPANY_EXTRACTION_WEBHOOK_URL no configurado")

  const callbackUrl = `${APP_URL}/api/webhooks/make/company-extraction`
  await fetch(MAKE_EXTRACTION_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, defaultDatasetId: datasetId, callbackUrl }),
  })
}

export async function getJobStatus(jobId: string) {
  const { data, error } = await supabase
    .from("search_jobs")
    .select("status, results_count, estimated_ready_at, dataset_id")
    .eq("id", jobId)
    .single()
  if (error) return null
  return data
}
