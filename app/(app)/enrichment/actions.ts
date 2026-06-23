"use server"

import { revalidatePath } from "next/cache"
import { supabase, supabaseAdmin } from "@/lib/supabase"
import { enrichProspect } from "@/lib/enrichment"
import { classifyIcp } from "@/lib/icp"

export async function getCampaigns() {
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, week_label, rep_name, industry, status, prospects_found")
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getProspectsForEnrichment(campaignId: string) {
  const { data, error } = await supabase
    .from("prospects")
    .select("id, first_name, last_name, full_name, job_title, company_name, company_domain, linkedin_url, email, email_status, email_provider, icp_score, icp_category, status")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function enrichOneProspect(prospectId: string): Promise<{
  email: string | null
  provider: string | null
  zbStatus: string | null
  icpCategory: string
  icpScore: number
}> {
  const { data: p } = await supabase
    .from("prospects")
    .select("id, first_name, last_name, company_name, company_domain, linkedin_url, job_title, email, email_status")
    .eq("id", prospectId)
    .single()

  if (!p) throw new Error("Prospecto no encontrado")

  // Skip if already has a valid email
  if (p.email && (p.email_status === "valid" || p.email_status === "catch-all")) {
    const { category, score } = classifyIcp(p.job_title ?? "")
    return { email: p.email, provider: null, zbStatus: p.email_status, icpCategory: category, icpScore: score }
  }

  const result = await enrichProspect({
    first_name: p.first_name ?? "",
    last_name: p.last_name ?? "",
    company_name: p.company_name ?? "",
    company_domain: p.company_domain,
    linkedin_url: p.linkedin_url ?? "",
  })

  const { category, score } = classifyIcp(p.job_title ?? "")

  await supabaseAdmin
    .from("prospects")
    .update({
      email: result.email,
      email_status: result.zbStatus,
      email_validated: result.enriched,
      email_provider: result.provider,
      icp_category: category,
      icp_score: score,
      status: "enriched",
    })
    .eq("id", prospectId)

  revalidatePath("/enrichment")
  revalidatePath("/prospects")

  return {
    email: result.email,
    provider: result.provider,
    zbStatus: result.zbStatus,
    icpCategory: category,
    icpScore: score,
  }
}

export async function classifyAllIcp(campaignId: string): Promise<number> {
  const { data, error } = await supabase
    .from("prospects")
    .select("id, job_title")
    .eq("campaign_id", campaignId)
  if (error) throw new Error(error.message)
  if (!data?.length) return 0

  let updated = 0
  for (const p of data) {
    const { category, score } = classifyIcp(p.job_title ?? "")
    await supabaseAdmin
      .from("prospects")
      .update({ icp_category: category, icp_score: score })
      .eq("id", p.id)
    updated++
  }

  revalidatePath("/enrichment")
  return updated
}
