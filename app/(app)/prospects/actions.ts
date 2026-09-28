"use server"

import { revalidatePath } from "next/cache"
import { supabase, supabaseAdmin } from "@/lib/supabase"
import { getTenantId } from "@/lib/tenant"

const SELECT = "id, first_name, last_name, full_name, job_title, company_name, company_domain, linkedin_url, connection_degree, location, email, icp_score, is_premium, status, started_role_months, highlights, created_at, campaign_id, campaigns(week_label, rep_name, industry)"

export type ProspectRow = {
  id: string; first_name: string; last_name: string; full_name: string
  job_title: string; company_name: string
  company_domain: string | null; linkedin_url: string; connection_degree: string
  location: string | null; email: string | null; icp_score: number
  is_premium: boolean; status: string
  started_role_months: number | null; highlights: string | null
  created_at: string; campaign_id: string
  campaigns: { week_label: string; rep_name: string; industry: string } | null
}

export async function getFilteredProspects(
  rep: string,
  industry: string,
  campaignId: string,
  page: number,
  search?: string
): Promise<{ data: ProspectRow[]; total: number }> {
  const tenantId = await getTenantId()
  const PAGE_SIZE = 100

  // Get all campaign IDs for this tenant (base filter)
  let campQuery = supabaseAdmin.from("campaigns").select("id").eq("tenant_id", tenantId)
  if (rep !== "all") campQuery = campQuery.eq("rep_name", rep)
  if (industry !== "all") campQuery = campQuery.eq("industry", industry)
  const { data: tenantCampaigns } = await campQuery
  const tenantCampaignIds = (tenantCampaigns ?? []).map((c: { id: string }) => c.id)

  if (campaignId !== "all" && !tenantCampaignIds.includes(campaignId)) {
    return { data: [], total: 0 }
  }

  let query = supabaseAdmin
    .from("prospects")
    .select(SELECT, { count: "exact" })
    .order("created_at", { ascending: false })

  if (campaignId !== "all") {
    query = query.eq("campaign_id", campaignId)
  } else {
    query = query.in("campaign_id", tenantCampaignIds)
  }

  if (search?.trim()) {
    const q = `%${search.trim()}%`
    query = query.or(`full_name.ilike.${q},job_title.ilike.${q},company_name.ilike.${q},email.ilike.${q}`)
  }

  const from = (page - 1) * PAGE_SIZE
  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1)
  if (error) throw new Error(error.message)
  return { data: (data ?? []) as unknown as ProspectRow[], total: count ?? 0 }
}

export async function getCampaignsForFilter(rep: string, industry: string) {
  const tenantId = await getTenantId()
  let query = supabaseAdmin.from("campaigns").select("id, week_label, rep_name, industry").eq("tenant_id", tenantId)
  if (rep !== "all") query = query.eq("rep_name", rep)
  if (industry !== "all") query = query.eq("industry", industry)
  const { data, error } = await query.order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as { id: string; week_label: string; rep_name: string; industry: string }[]
}

export async function getAllFilteredProspects(
  rep: string,
  industry: string,
  campaignId: string
): Promise<ProspectRow[]> {
  const tenantId = await getTenantId()
  const BATCH = 1000
  let all: ProspectRow[] = []
  let from = 0

  // Resolve tenant campaign IDs once
  let campQuery = supabaseAdmin.from("campaigns").select("id").eq("tenant_id", tenantId)
  if (rep !== "all") campQuery = campQuery.eq("rep_name", rep)
  if (industry !== "all") campQuery = campQuery.eq("industry", industry)
  const { data: tenantCampaigns } = await campQuery
  const tenantCampaignIds = (tenantCampaigns ?? []).map((c: { id: string }) => c.id)

  while (true) {
    let query = supabaseAdmin
      .from("prospects")
      .select(SELECT)
      .order("created_at", { ascending: false })

    if (campaignId !== "all") {
      query = query.eq("campaign_id", campaignId)
    } else {
      query = query.in("campaign_id", tenantCampaignIds)
    }

    const { data, error } = await query.range(from, from + BATCH - 1)
    if (error) throw new Error(error.message)
    const batch = (data ?? []) as unknown as ProspectRow[]
    all = all.concat(batch)
    if (batch.length < BATCH) break
    from += BATCH
  }

  return all
}

export async function deleteProspects(ids: string[]): Promise<void> {
  if (!ids.length) return
  const { error } = await supabaseAdmin.from("prospects").delete().in("id", ids)
  if (error) throw new Error(error.message)
  revalidatePath("/prospects")
}
