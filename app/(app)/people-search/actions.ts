"use server"

import { revalidatePath } from "next/cache"
import { supabase } from "@/lib/supabase"
import { supabaseAdmin } from "@/lib/supabase"
import { startSalesNavRun } from "@/lib/apify"
import { updateAccountListInUrl } from "@/lib/sales-nav-lists"
import { incrementSavedUrlUsage } from "@/app/(app)/settings/actions"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

// 500 personas ≈ 20 min
function estimatedMinutes(maxResults: number) {
  return Math.ceil((maxResults / 500) * 20)
}

export async function getCampaigns() {
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, week_label, rep_name, industry, status, list_id, list_name")
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
  // URLs come from the saved_urls repository (people_search type, ordered by creation)
  const { data: savedUrls, error: urlsError } = await supabase
    .from("saved_urls")
    .select("url")
    .eq("rep_name", repName)
    .eq("industry", industry)
    .eq("url_type", "people_search")
    .order("created_at", { ascending: true })
  if (urlsError) throw new Error(urlsError.message)

  if (!savedUrls || savedUrls.length === 0) return null

  const base_url = savedUrls[0].url
  const base_url_2 = savedUrls[1]?.url ?? null

  // List state from people_search_configs (may not exist yet — that's fine)
  const { data: config } = await supabase
    .from("people_search_configs")
    .select("list_id, list_name, prev_list_id, prev_list_name, last_result_count, last_count_checked_at, last_result_count_2, last_count_2_checked_at")
    .eq("rep_name", repName)
    .eq("industry", industry)
    .maybeSingle()

  return {
    base_url,
    base_url_2,
    list_id: config?.list_id ?? null,
    list_name: config?.list_name ?? null,
    prev_list_id: config?.prev_list_id ?? null,
    prev_list_name: config?.prev_list_name ?? null,
    last_result_count: config?.last_result_count ?? null,
    last_count_checked_at: config?.last_count_checked_at ?? null,
    last_result_count_2: config?.last_result_count_2 ?? null,
    last_count_2_checked_at: config?.last_count_2_checked_at ?? null,
  }
}

export async function generatePeopleSearchUrl(
  baseUrl: string,
  listId: string,
  listName: string
): Promise<string> {
  return updateAccountListInUrl(baseUrl, listId, listName)
}

export async function upsertPeopleSearchConfig2(
  repName: string,
  industry: string,
  baseUrl2: string
) {
  const { error } = await supabaseAdmin
    .from("people_search_configs")
    .update({ base_url_2: baseUrl2, updated_at: new Date().toISOString() })
    .eq("rep_name", repName)
    .eq("industry", industry)
  if (error) throw new Error(error.message)
  revalidatePath("/people-search")
}

export async function updateActiveList(
  repName: string,
  industry: string,
  listId: string,
  listName: string
) {
  // Fetch current list before overwriting so we can track it as prev
  const { data: current } = await supabase
    .from("people_search_configs")
    .select("list_id, list_name")
    .eq("rep_name", repName)
    .eq("industry", industry)
    .maybeSingle()

  const { error } = await supabaseAdmin
    .from("people_search_configs")
    .update({
      list_id: listId,
      list_name: listName,
      prev_list_id: current?.list_id ?? null,
      prev_list_name: current?.list_name ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("rep_name", repName)
    .eq("industry", industry)

  if (error) throw new Error(error.message)
  revalidatePath("/people-search")
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
  maxResults: number,
  salesNavUrl: string
): Promise<{ jobId: string; extensionUrl: string } | { error: string }> {
  try {
    if (!salesNavUrl) return { error: "No hay URL configurada para esta búsqueda" }

    const { data: job, error } = await supabase
      .from("search_jobs")
      .insert({
        campaign_id: campaignId,
        job_type: "people_search",
        sales_nav_url: salesNavUrl,
        status: "pending",
        max_results: maxResults,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    // Append our params to the existing hash (avoids double-# which breaks Sales Nav).
    // Sales Nav reads only "query=" from the hash and ignores unknown params.
    const callbackUrl = encodeURIComponent(`${APP_URL}/api/extension/results`)
    const hashSep = salesNavUrl.includes('#') ? '&' : '#'
    const extensionUrl = `${salesNavUrl}${hashSep}_mode=people_scrape&_job=${job.id}&_cb=${callbackUrl}`

    // Increment usage counter
    const config = await getPeopleSearchConfig(repName, industry)
    if (config?.base_url) {
      incrementSavedUrlUsage(repName, industry, "people_search", config.base_url).catch(() => {})
    }

    revalidatePath("/people-search")
    return { jobId: job.id, extensionUrl }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error al iniciar la búsqueda" }
  }
}

export async function getProspectsForCampaign(campaignId: string) {
  const { data, error } = await supabase
    .from("prospects")
    .select("id, first_name, last_name, full_name, job_title, company_name, linkedin_url, connection_degree, location")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function saveResultCount(repName: string, industry: string, count: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from("people_search_configs")
    .update({
      last_result_count: count,
      last_count_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("rep_name", repName)
    .eq("industry", industry)
  if (error) throw new Error(error.message)
}

export async function deleteSearchJobs(ids: string[]): Promise<void> {
  if (!ids.length) return
  const { error } = await supabaseAdmin.from("search_jobs").delete().in("id", ids)
  if (error) throw new Error(error.message)
  revalidatePath("/people-search")
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
