"use server"

import { revalidatePath } from "next/cache"
import { supabase, supabaseAdmin } from "@/lib/supabase"
import { updateAccountListInUrl } from "@/lib/sales-nav-lists"

export async function getCampaignWithAccounts(campaignId: string) {
  const [campaignRes, accountsRes] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, week_label, rep_name, industry, status, accounts_found, prospects_found, list_id, list_name")
      .eq("id", campaignId)
      .single(),
    supabase
      .from("accounts")
      .select("id, company_name, domain, sales_nav_id, headcount_range, status, created_at")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false }),
  ])

  if (campaignRes.error) throw new Error(campaignRes.error.message)
  if (accountsRes.error) throw new Error(accountsRes.error.message)

  return { campaign: campaignRes.data, accounts: accountsRes.data ?? [] }
}

export async function updateAccount(
  accountId: string,
  campaignId: string,
  updates: { company_name?: string; domain?: string | null; sales_nav_id?: string | null; status?: string }
) {
  const { error } = await supabaseAdmin
    .from("accounts")
    .update(updates)
    .eq("id", accountId)

  if (error) throw new Error(error.message)
  revalidatePath(`/campaigns/${campaignId}`)
}

export async function saveCampaignList(
  campaignId: string,
  repName: string,
  industry: string,
  listId: string,
  listName: string
): Promise<{ warning?: string }> {
  // 1. Save list to the campaign record
  const { error: campaignError } = await supabaseAdmin
    .from("campaigns")
    .update({ list_id: listId, list_name: listName })
    .eq("id", campaignId)
  if (campaignError) throw new Error(campaignError.message)

  // 2. If people_search_configs exists for this rep+industry, update the URL too
  const { data: config } = await supabaseAdmin
    .from("people_search_configs")
    .select("base_url")
    .eq("rep_name", repName)
    .eq("industry", industry)
    .maybeSingle()

  if (!config?.base_url) {
    revalidatePath(`/campaigns/${campaignId}`)
    return { warning: `Lista guardada en la campaña. Configurá la URL base en People Search para que la URL se actualice automáticamente.` }
  }

  const updatedUrl = updateAccountListInUrl(config.base_url, listId, listName)

  const { error } = await supabaseAdmin
    .from("people_search_configs")
    .update({ base_url: updatedUrl, list_id: listId, list_name: listName, updated_at: new Date().toISOString() })
    .eq("rep_name", repName)
    .eq("industry", industry)

  if (error) throw new Error(error.message)
  revalidatePath(`/campaigns/${campaignId}`)
  revalidatePath("/people-search")
  return {}
}

export async function deleteAccount(accountId: string, campaignId: string) {
  const { error } = await supabaseAdmin
    .from("accounts")
    .delete()
    .eq("id", accountId)

  if (error) throw new Error(error.message)

  // Update accounts_found count
  const { data: remaining } = await supabase
    .from("accounts")
    .select("id", { count: "exact" })
    .eq("campaign_id", campaignId)

  await supabaseAdmin
    .from("campaigns")
    .update({ accounts_found: remaining?.length ?? 0 })
    .eq("id", campaignId)

  revalidatePath(`/campaigns/${campaignId}`)
}
