"use server"

import { revalidatePath } from "next/cache"
import { supabase, supabaseAdmin } from "@/lib/supabase"

export async function getAllProspects() {
  const { data, error } = await supabaseAdmin
    .from("prospects")
    .select("id, first_name, last_name, full_name, job_title, company_name, company_domain, linkedin_url, connection_degree, location, email, icp_score, is_premium, status, started_role_months, highlights, created_at, campaign_id, campaigns(week_label, rep_name, industry)")
    .order("created_at", { ascending: false })
    .limit(50000)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as {
    id: string; first_name: string; last_name: string; full_name: string
    job_title: string; company_name: string
    company_domain: string | null; linkedin_url: string; connection_degree: string
    location: string | null; email: string | null; icp_score: number
    is_premium: boolean; status: string
    started_role_months: number | null; highlights: string | null
    created_at: string; campaign_id: string
    campaigns: { week_label: string; rep_name: string; industry: string } | null
  }[]
}

export async function deleteProspects(ids: string[]): Promise<void> {
  if (!ids.length) return
  const { error } = await supabaseAdmin.from("prospects").delete().in("id", ids)
  if (error) throw new Error(error.message)
  revalidatePath("/prospects")
}
