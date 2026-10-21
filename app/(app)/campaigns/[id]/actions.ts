"use server"

import { revalidatePath } from "next/cache"
import { supabase, supabaseAdmin } from "@/lib/supabase"
import Anthropic from "@anthropic-ai/sdk"
import { getContactLists, getContactsFromList, type HubspotList } from "@/lib/hubspot"

export type AutoCampaignData = {
  id: string
  status: string
  current_step_detail: string | null
  enrichment_offset: number
  error_message: string | null
  scheduled_at: string
  completed_at: string | null
  result_companies: number | null
  result_people: number | null
  result_emails_found: number | null
  result_icp_distribution: Record<string, number> | null
  result_shortlisted: number | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result_distributed: any | null
  distribution_template_name: string | null
  company_count: number
  people_count: number
}

export async function getAutoCampaignForCampaign(campaignId: string): Promise<AutoCampaignData | null> {
  const { data } = await supabaseAdmin
    .from("auto_campaigns")
    .select("id, status, current_step_detail, enrichment_offset, error_message, scheduled_at, completed_at, result_companies, result_people, result_emails_found, result_icp_distribution, result_shortlisted, result_distributed, distribution_template_name, company_count, people_count")
    .eq("campaign_id", campaignId)
    .maybeSingle()
  return data as AutoCampaignData | null
}

export async function getCompanySearchJobForCampaign(campaignId: string) {
  const { data } = await supabaseAdmin
    .from("search_jobs")
    .select("id, status, sales_nav_url, job_type")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function getCampaignWithAccounts(campaignId: string) {
  const [campaignRes, accountsRes] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, week_label, rep_name, industry, status, campaign_type, accounts_found, prospects_found, list_id, list_name")
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

// ── Import CSV ────────────────────────────────────────────────────────────────

export type ImportRow = {
  first_name?: string
  last_name?: string
  full_name?: string
  company_name?: string
  job_title?: string
  email?: string
  linkedin_url?: string
}

export async function importProspectsFromCsv(campaignId: string, rows: ImportRow[]) {
  if (!rows.length) throw new Error("No hay filas para importar")

  const inserts = rows.map((r) => ({
    campaign_id: campaignId,
    first_name: r.first_name?.trim() || null,
    last_name: r.last_name?.trim() || null,
    full_name: r.full_name?.trim() || [r.first_name, r.last_name].filter(Boolean).join(" ") || null,
    company_name: r.company_name?.trim() || null,
    job_title: r.job_title?.trim() || null,
    email: r.email?.trim().toLowerCase() || null,
    linkedin_url: r.linkedin_url?.trim() || null,
    status: "scraped" as const,
  }))

  const { error } = await supabaseAdmin.from("prospects").insert(inserts)
  if (error) throw new Error(error.message)

  await supabaseAdmin
    .from("campaigns")
    .update({ prospects_found: rows.length })
    .eq("id", campaignId)

  revalidatePath(`/campaigns/${campaignId}`)
  return { imported: rows.length }
}

// ── Claude Search ─────────────────────────────────────────────────────────────

export type ClaudeCompany = {
  company_name: string
  domain: string | null
  industry: string | null
  headcount_range: string | null
  why: string
}

export async function generateCompaniesWithClaude(
  campaignId: string,
  prompt: string,
  industry: string
): Promise<{ companies: ClaudeCompany[] } | { error: string }> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return { error: "ANTHROPIC_API_KEY no configurada" }

    const anthropic = new Anthropic({ apiKey })

    const message = await anthropic.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 4096,
      system: `You are a B2B prospecting expert for the Latin American market.
The user will describe the type of company they want to prospect.
Your task is to return a list of REAL companies matching that profile.
IMPORTANT: Return ONLY a valid JSON array. No explanation, no markdown, no extra text.
Use exactly this structure:
[{"company_name":"...","domain":"...","industry":"...","headcount_range":"...","why":"..."}]
Rules:
- domain: primary domain only (e.g. "empresa.com"), null if unsure
- headcount_range: approximate range ("1-50","51-200","201-500","501-1000","1000+") or null
- why: 1 sentence explaining why it matches the ICP
- Return between 10 and 30 companies
- Output ONLY the JSON array, nothing else`,
      messages: [
        { role: "user", content: `Campaign industry/context: ${industry}\n\nICP description: ${prompt}` },
      ],
    })

    const textBlock = message.content.find((b) => b.type === "text")
    const text = textBlock?.type === "text" ? textBlock.text.trim() : ""
    const jsonStr = (text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/)?.[1]) ?? text.match(/\[[\s\S]*\]/)?.[0]
    if (!jsonStr) return { error: `Sin JSON. Modelo: ${message.model}. Respuesta: ${text.slice(0, 400)}` }

    const companies: ClaudeCompany[] = JSON.parse(jsonStr)

    const inserts = companies.map((c) => ({
      campaign_id: campaignId,
      company_name: c.company_name,
      domain: c.domain ?? null,
      industry: c.industry ?? industry,
      headcount_range: c.headcount_range ?? null,
      status: "discovered" as const,
    }))

    const { error: dbError } = await supabaseAdmin.from("accounts").insert(inserts)
    if (dbError) return { error: dbError.message }

    await supabaseAdmin
      .from("campaigns")
      .update({ accounts_found: companies.length })
      .eq("id", campaignId)

    revalidatePath(`/campaigns/${campaignId}`)
    return { companies }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error desconocido" }
  }
}

// ── CRM Sync (HubSpot) ────────────────────────────────────────────────────────

async function getHubspotApiKey(): Promise<string> {
  const { getTenantId } = await import("@/lib/tenant")
  const { getTenantConfig } = await import("@/lib/tenant-config")
  const tenantId = await getTenantId()
  const cfg = await getTenantConfig(tenantId)
  const key = cfg?.hubspot_api_key
  if (!key) throw new Error("HubSpot API key no configurada en Settings")
  return key
}

export async function getHubspotLists(): Promise<{ lists: HubspotList[] } | { error: string }> {
  try {
    const apiKey = await getHubspotApiKey()
    const lists = await getContactLists(apiKey)
    return { lists }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al obtener listas" }
  }
}

export async function importFromHubspotList(
  campaignId: string,
  listId: string
): Promise<{ imported: number; skipped: number } | { error: string }> {
  try {
    const apiKey = await getHubspotApiKey()
    const contacts = await getContactsFromList(apiKey, listId)
    if (contacts.length === 0) return { imported: 0, skipped: 0 }

    const rows = contacts.map((c) => ({
      campaign_id: campaignId,
      first_name: c.firstName ?? "",
      last_name: c.lastName ?? "",
      full_name: [c.firstName, c.lastName].filter(Boolean).join(" ") || null,
      email: c.email ?? null,
      email_status: c.email ? "unknown" : null,
      job_title: c.jobTitle ?? null,
      company_name: c.company ?? null,
      company_domain: c.domain ?? null,
      phone: c.phone ?? null,
      linkedin_url: c.linkedinUrl ?? null,
      status: "scraped" as const,
    }))

    const { error: dbError } = await supabaseAdmin.from("prospects").insert(rows)
    if (dbError) return { error: dbError.message }

    await supabaseAdmin
      .from("campaigns")
      .update({ prospects_found: rows.length })
      .eq("id", campaignId)

    revalidatePath(`/campaigns/${campaignId}`)
    return { imported: rows.length, skipped: 0 }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al importar" }
  }
}
