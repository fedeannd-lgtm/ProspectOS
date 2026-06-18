"use server"

import { revalidatePath } from "next/cache"
import { supabase, supabaseAdmin } from "@/lib/supabase"
import { startSalesNavRun } from "@/lib/apify"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

// 50 empresas ≈ 20 min
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
  const config = await getSearchConfig(repName, industry)
  if (!config) throw new Error("No hay URL configurada para este rep+industria")

  const { data: repConfig } = await supabase
    .from("rep_configs")
    .select("linkedin_cookie")
    .eq("rep_name", repName)
    .maybeSingle()
  if (!repConfig?.linkedin_cookie) throw new Error(`Cookie no configurada para ${repName}. Actualizala en Settings.`)

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

  let cookieParsed: unknown
  try {
    cookieParsed = JSON.parse(repConfig.linkedin_cookie)
  } catch {
    throw new Error(`La cookie de ${repName} no es JSON válido. Exportala desde Cookie-Editor como JSON y pegala de nuevo en Settings.`)
  }

  const webhookUrl = `${APP_URL}/api/webhooks/apify/run-complete?jobId=${job.id}`
  const runId = await startSalesNavRun({
    cookie: cookieParsed,
    searchUrl: config.base_url,
    count: maxResults,
    startPage: config.next_page,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    deepScrape: true,
    stopOnRateLimit: true,
    minDelay: 5,
    maxDelay: 30,
  }, webhookUrl)

  await supabase.from("search_jobs").update({ apify_run_id: runId }).eq("id", job.id)

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

export async function getJobStatus(jobId: string) {
  const { data, error } = await supabase
    .from("search_jobs")
    .select("status, results_count, estimated_ready_at")
    .eq("id", jobId)
    .single()
  if (error) return null
  return data
}
