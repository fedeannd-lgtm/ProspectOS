"use server"

import { revalidatePath } from "next/cache"
import { supabase, supabaseAdmin } from "@/lib/supabase"

const MAKE_WEBHOOK = process.env.MAKE_PEOPLE_SEARCH_WEBHOOK_URL!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

// 500 personas ≈ 20 min
function estimatedMinutes(maxResults: number) {
  return Math.ceil((maxResults / 500) * 20)
}

export async function getCampaigns() {
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, week_label, rep_name, industry, status")
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function getPeopleSearchJobs() {
  const { data, error } = await supabase
    .from("search_jobs")
    .select("*, campaigns(week_label, rep_name, industry)")
    .eq("job_type", "people_search")
    .order("created_at", { ascending: false })
    .limit(20)
  if (error) throw new Error(error.message)
  return data
}

export async function getPeopleSearchConfig(repName: string, industry: string) {
  const { data, error } = await supabase
    .from("people_search_configs")
    .select("base_url")
    .eq("rep_name", repName)
    .eq("industry", industry)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as { base_url: string } | null
}

export async function upsertPeopleSearchConfig(
  repName: string,
  industry: string,
  baseUrl: string
) {
  const { error } = await supabase
    .from("people_search_configs")
    .upsert(
      { rep_name: repName, industry, base_url: baseUrl, updated_at: new Date().toISOString() },
      { onConflict: "rep_name,industry" }
    )
  if (error) throw new Error(error.message)
  revalidatePath("/people-search")
}

export async function getAccountsForCampaign(campaignId: string) {
  const { data, error } = await supabase
    .from("accounts")
    .select("company_name, domain")
    .eq("campaign_id", campaignId)
    .order("company_name")
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function triggerPeopleSearch(
  campaignId: string,
  repName: string,
  industry: string,
  maxResults: number
) {
  if (!MAKE_WEBHOOK) throw new Error("MAKE_PEOPLE_SEARCH_WEBHOOK_URL no configurado en .env.local")

  const config = await getPeopleSearchConfig(repName, industry)
  if (!config) throw new Error("No hay URL configurada para este rep+industria")

  const estimatedReadyAt = new Date(
    Date.now() + estimatedMinutes(maxResults) * 60 * 1000
  ).toISOString()

  const { data: job, error } = await supabase
    .from("search_jobs")
    .insert({
      campaign_id: campaignId,
      job_type: "people_search",
      sales_nav_url: config.base_url,
      status: "running",
      max_results: maxResults,
      estimated_ready_at: estimatedReadyAt,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  const { data: repConfig } = await supabase
    .from("rep_configs")
    .select("linkedin_cookie")
    .eq("rep_name", repName)
    .maybeSingle()

  if (!repConfig?.linkedin_cookie) throw new Error(`Cookie no configurada para ${repName}. Actualizala en Settings.`)

  const callbackUrl = `${APP_URL}/api/webhooks/make/people-extraction`
  await fetch(MAKE_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: job.id,
      campaignId,
      repName,
      cookie: repConfig.linkedin_cookie,
      salesNavUrl: config.base_url,
      maxResults,
      callbackUrl,
    }),
  })

  revalidatePath("/people-search")
  return { jobId: job.id, estimatedReadyAt }
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
