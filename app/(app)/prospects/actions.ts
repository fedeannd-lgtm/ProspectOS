"use server"

import { revalidatePath } from "next/cache"
import { supabase, supabaseAdmin } from "@/lib/supabase"

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
  page: number
): Promise<{ data: ProspectRow[]; total: number }> {
  const PAGE_SIZE = 100
  let query = supabaseAdmin
    .from("prospects")
    .select(SELECT, { count: "exact" })
    .order("created_at", { ascending: false })

  // Join-based filters via campaigns relationship
  if (rep !== "all") {
    const { data: campaignIds } = await supabaseAdmin
      .from("campaigns")
      .select("id")
      .eq("rep_name", rep)
    query = query.in("campaign_id", (campaignIds ?? []).map((c: { id: string }) => c.id))
  }
  if (industry !== "all") {
    const { data: campaignIds } = await supabaseAdmin
      .from("campaigns")
      .select("id")
      .eq("industry", industry)
    query = query.in("campaign_id", (campaignIds ?? []).map((c: { id: string }) => c.id))
  }
  if (campaignId !== "all") {
    query = query.eq("campaign_id", campaignId)
  }

  const from = (page - 1) * PAGE_SIZE
  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1)
  if (error) throw new Error(error.message)
  return { data: (data ?? []) as unknown as ProspectRow[], total: count ?? 0 }
}

export async function getCampaignsForFilter(rep: string, industry: string) {
  let query = supabaseAdmin.from("campaigns").select("id, week_label, rep_name, industry")
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
  const BATCH = 1000
  let all: ProspectRow[] = []
  let from = 0

  while (true) {
    let query = supabaseAdmin
      .from("prospects")
      .select(SELECT)
      .order("created_at", { ascending: false })

    if (rep !== "all") {
      const { data: ids } = await supabaseAdmin.from("campaigns").select("id").eq("rep_name", rep)
      query = query.in("campaign_id", (ids ?? []).map((c: { id: string }) => c.id))
    }
    if (industry !== "all") {
      const { data: ids } = await supabaseAdmin.from("campaigns").select("id").eq("industry", industry)
      query = query.in("campaign_id", (ids ?? []).map((c: { id: string }) => c.id))
    }
    if (campaignId !== "all") query = query.eq("campaign_id", campaignId)

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
