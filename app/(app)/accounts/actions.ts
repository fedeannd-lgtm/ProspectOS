"use server"

import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/tenant"

export async function getAllAccounts() {
  const tenantId = await getTenantId()
  const { data, error } = await supabase
    .from("accounts")
    .select("id, company_name, domain, sales_nav_id, headcount_range, status, created_at, campaign_id, campaigns!inner(week_label, rep_name, industry, tenant_id)")
    .eq("campaigns.tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(2000)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as {
    id: string
    company_name: string
    domain: string | null
    sales_nav_id: string | null
    headcount_range: string | null
    status: string
    created_at: string
    campaign_id: string
    campaigns: { week_label: string; rep_name: string; industry: string } | null
  }[]
}
