"use server"

import { supabase } from "@/lib/supabase"

export async function getAllProspects() {
  const { data, error } = await supabase
    .from("prospects")
    .select("id, full_name, job_title, company_name, linkedin_url, connection_degree, email, icp_score, status, created_at, campaign_id, campaigns(week_label, rep_name, industry)")
    .order("created_at", { ascending: false })
    .limit(500)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as {
    id: string; full_name: string; job_title: string; company_name: string
    linkedin_url: string; connection_degree: string; email: string | null
    icp_score: number; status: string; created_at: string; campaign_id: string
    campaigns: { week_label: string; rep_name: string; industry: string } | null
  }[]
}
