"use server"

import { revalidatePath } from "next/cache"
import { supabase, supabaseAdmin } from "@/lib/supabase"
import Anthropic from "@anthropic-ai/sdk"

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
): Promise<ClaudeCompany[]> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: `Sos un asistente experto en prospección B2B para el mercado latinoamericano.
El usuario va a describir el tipo de empresa que quiere prospectar.
Tu tarea es devolver una lista de empresas REALES que matchean ese perfil.
Devolvé ÚNICAMENTE un JSON válido: un array de objetos con esta estructura exacta:
[{"company_name":"...","domain":"...","industry":"...","headcount_range":"...","why":"..."}]
- domain: solo el dominio principal (ej: "empresa.com"), null si no lo sabés con certeza
- headcount_range: rango aproximado ("1-50", "51-200", "201-500", "501-1000", "1000+") o null
- why: 1 oración explicando por qué encaja con el ICP
- Devolvé entre 10 y 30 empresas
- No incluyas texto fuera del JSON`,
    messages: [{
      role: "user",
      content: `Industria/contexto de la campaña: ${industry}\n\nDescripción del ICP: ${prompt}`,
    }],
  })

  const text = message.content[0].type === "text" ? message.content[0].text : ""
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error("Claude no devolvió JSON válido")

  const companies: ClaudeCompany[] = JSON.parse(jsonMatch[0])

  const inserts = companies.map((c) => ({
    campaign_id: campaignId,
    company_name: c.company_name,
    domain: c.domain ?? null,
    industry: c.industry ?? industry,
    headcount_range: c.headcount_range ?? null,
    status: "discovered" as const,
  }))

  const { error } = await supabaseAdmin.from("accounts").insert(inserts)
  if (error) throw new Error(error.message)

  await supabaseAdmin
    .from("campaigns")
    .update({ accounts_found: companies.length })
    .eq("id", campaignId)

  revalidatePath(`/campaigns/${campaignId}`)
  return companies
}
