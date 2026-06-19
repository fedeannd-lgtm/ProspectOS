import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { getDatasetItems, startAccountListActor } from "@/lib/apify"
import { advanceSearchPage } from "@/app/(app)/company-search/actions"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

type ApifyWebhookBody = {
  eventType: string
  resource: {
    id: string
    defaultDatasetId: string
    status: string
  }
}

type ApifyCompany = { companyName?: string; id?: string; website?: string }
type ApifyPerson = {
  firstName?: string
  lastName?: string
  fullName?: string
  jobTitle?: string
  headline?: string
  profileUrl?: string
  companyName?: string
  premium?: boolean
  connectionType?: number           // 1=FIRST, 2=SECOND, 3=THIRD
  currentPositions?: Array<{
    title?: string
    startedOn?: { month?: number; year?: number }
  }>
  highlights?: Array<{ name?: string; description?: string }>
}

export async function POST(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId")
  if (!jobId) return NextResponse.json({ error: "jobId requerido" }, { status: 400 })

  const body = await req.json() as ApifyWebhookBody
  const { resource } = body

  if (resource.status === "FAILED") {
    await supabaseAdmin.from("search_jobs").update({ status: "failed" }).eq("id", jobId)
    return NextResponse.json({ ok: true })
  }

  const { data: job } = await supabaseAdmin
    .from("search_jobs")
    .select("job_type, campaign_id, campaigns(rep_name, industry)")
    .eq("id", jobId)
    .single()

  if (!job) return NextResponse.json({ error: "Job no encontrado" }, { status: 404 })

  const items = await getDatasetItems(resource.defaultDatasetId)

  if (job.job_type === "company_search") {
    await processCompanySearch(jobId, job, items as ApifyCompany[])
  } else {
    await processPeopleSearch(jobId, job, items as ApifyPerson[])
  }

  return NextResponse.json({ ok: true, processed: items.length })
}

async function processCompanySearch(
  jobId: string,
  job: { campaign_id: string; campaigns: unknown },
  companies: ApifyCompany[]
) {
  const accounts = companies.map((c) => ({
    campaign_id: job.campaign_id,
    company_name: (c.companyName ?? "") as string,
    domain: (c.website ?? "") as string,
    sales_nav_id: (c.id ?? "") as string,
  }))

  if (accounts.length > 0) await supabaseAdmin.from("accounts").insert(accounts)

  await supabaseAdmin
    .from("search_jobs")
    .update({ status: "completed", results_count: accounts.length, completed_at: new Date().toISOString() })
    .eq("id", jobId)

  await supabaseAdmin
    .from("campaigns")
    .update({ accounts_found: accounts.length })
    .eq("id", job.campaign_id)

  const campaign = job.campaigns as { rep_name: string; industry: string } | null
  if (campaign) {
    await advanceSearchPage(campaign.rep_name, campaign.industry, accounts.length)
    await triggerAccountListCreation(jobId, campaign, accounts)
  }
}

async function triggerAccountListCreation(
  jobId: string,
  campaign: { rep_name: string; industry: string },
  accounts: { sales_nav_id: string; company_name: string }[]
) {
  if (!process.env.ACCOUNT_LIST_ACTOR_ID) {
    console.log("[account-list] ACCOUNT_LIST_ACTOR_ID not set — skipping")
    return
  }

  const companyIds = accounts.map((a) => a.sales_nav_id).filter(Boolean)
  if (companyIds.length === 0) return

  const { data: repConfig } = await supabaseAdmin
    .from("rep_configs")
    .select("linkedin_cookie")
    .eq("rep_name", campaign.rep_name)
    .maybeSingle()

  if (!repConfig?.linkedin_cookie) {
    console.warn("[account-list] No cookie for", campaign.rep_name)
    return
  }

  let cookieParsed: unknown
  try { cookieParsed = JSON.parse(repConfig.linkedin_cookie) } catch { return }

  const today = new Date().toLocaleDateString("es-AR", { day: "numeric", month: "numeric", year: "numeric" })
  const listName = `Empresas ${campaign.rep_name} ${campaign.industry} ${today}`
  const webhookUrl = `${APP_URL}/api/webhooks/apify/list-created?jobId=${jobId}`

  try {
    await startAccountListActor({ cookie: cookieParsed, companyIds, listName }, webhookUrl)
    console.log(`[account-list] Started actor for ${listName}`)
  } catch (err) {
    console.error("[account-list] Failed to start actor:", err)
  }
}

function extractDomain(raw: string): string {
  if (!raw) return ""
  try {
    const url = raw.startsWith("http") ? raw : `https://${raw}`
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return raw.replace(/^https?:\/\/(www\.)?/, "").split("/")[0].toLowerCase()
  }
}

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(s\.?a\.?c?\.?i?\.?f?\.?e?\.?\s?i?\.?|s\.?r\.?l\.?|ltd\.?|inc\.?|corp\.?|s\.?a\.?s\.?|b\.?v\.?)\b/gi, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

async function processPeopleSearch(
  jobId: string,
  job: { campaign_id: string },
  people: ApifyPerson[]
) {
  // Load all accounts globally to match company name → domain + account_id
  const { data: accounts } = await supabaseAdmin
    .from("accounts")
    .select("id, company_name, domain, campaign_id")

  const nameToAccount = new Map<string, { id: string; domain: string }>()
  // Insert campaign accounts last so they take priority over other campaigns
  const sorted = [...(accounts ?? [])].sort((a, b) =>
    a.campaign_id === job.campaign_id ? 1 : b.campaign_id === job.campaign_id ? -1 : 0
  )
  sorted.forEach((a) => {
    if (a.company_name) {
      nameToAccount.set(normalizeCompanyName(a.company_name), {
        id: a.id,
        domain: extractDomain(a.domain ?? ""),
      })
    }
  })

  const degreeLabel: Record<number, string> = { 1: "FIRST", 2: "SECOND", 3: "THIRD" }

  const prospects = people.map((p) => {
    const normalizedName = p.companyName ? normalizeCompanyName(p.companyName) : ""
    const matched = normalizedName ? nameToAccount.get(normalizedName) : null
    const startedOnMonth = p.currentPositions?.[0]?.startedOn?.month ?? null
    const highlights = p.highlights
      ?.map((h) => h.name || h.description || "")
      .filter(Boolean)
      .join(", ") || null

    return {
      campaign_id: job.campaign_id,
      account_id: matched?.id ?? null,
      first_name: p.firstName ?? "",
      last_name: p.lastName ?? "",
      full_name: p.fullName ?? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim(),
      job_title: p.jobTitle ?? p.currentPositions?.[0]?.title ?? p.headline ?? "",
      linkedin_url: p.profileUrl ?? "",
      company_name: p.companyName ?? "",
      company_domain: matched?.domain ?? "",
      is_premium: p.premium ?? false,
      connection_degree: p.connectionType ? (degreeLabel[p.connectionType] ?? String(p.connectionType)) : "",
      started_role_months: startedOnMonth,
      highlights,
    }
  })

  if (prospects.length > 0) await supabaseAdmin.from("prospects").insert(prospects)

  await supabaseAdmin
    .from("search_jobs")
    .update({ status: "completed", results_count: prospects.length, completed_at: new Date().toISOString() })
    .eq("id", jobId)

  await supabaseAdmin
    .from("campaigns")
    .update({ prospects_found: prospects.length })
    .eq("id", job.campaign_id)
}
