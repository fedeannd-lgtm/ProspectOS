import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { getDatasetItems } from "@/lib/apify"
import { advanceSearchPage } from "@/app/(app)/company-search/actions"


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
  location?: string
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

const STOPWORDS = new Set(["del", "los", "las", "una", "uno", "con", "por", "que", "son", "sus", "and", "the", "for"])

function sigWords(s: string): string[] {
  return s.split(/\s+/).filter((w) => w.length >= 3 && !STOPWORDS.has(w))
}

async function processPeopleSearch(
  jobId: string,
  job: { campaign_id: string },
  people: ApifyPerson[]
) {
  const { data: accounts } = await supabaseAdmin
    .from("accounts")
    .select("id, company_name, domain, campaign_id")

  type AccountVal = { id: string; domain: string; norm: string }
  const nameToAccount = new Map<string, AccountVal>()
  // Current campaign accounts inserted last → override others on exact match
  const sorted = [...(accounts ?? [])].sort((a, b) =>
    a.campaign_id === job.campaign_id ? 1 : b.campaign_id === job.campaign_id ? -1 : 0
  )
  sorted.forEach((a) => {
    if (a.company_name) {
      const norm = normalizeCompanyName(a.company_name)
      nameToAccount.set(norm, { id: a.id, domain: extractDomain(a.domain ?? ""), norm })
    }
  })

  function findBestMatch(companyName: string): AccountVal | null {
    if (!companyName) return null
    const norm = normalizeCompanyName(companyName)
    if (!norm) return null

    // 1. Exact normalized match
    const exact = nameToAccount.get(norm)
    if (exact) return exact

    // 2. Substring — account name contained in prospect name (or vice versa), min 6 chars
    let subMatch: AccountVal | null = null
    let bestSubLen = 0
    for (const [accountNorm, val] of nameToAccount.entries()) {
      if (accountNorm.length >= 6 && norm.includes(accountNorm) && accountNorm.length > bestSubLen) {
        subMatch = val; bestSubLen = accountNorm.length
      } else if (norm.length >= 6 && accountNorm.includes(norm) && norm.length > bestSubLen) {
        subMatch = val; bestSubLen = norm.length
      }
    }
    if (subMatch) return subMatch

    // 3. Word overlap — share ≥2 significant words
    const pWords = sigWords(norm)
    if (pWords.length < 2) return null
    let best: AccountVal | null = null
    let bestCount = 0
    for (const [accountNorm, val] of nameToAccount.entries()) {
      const aWords = sigWords(accountNorm)
      const shared = pWords.filter((w) => aWords.includes(w)).length
      if (shared >= 2 && shared > bestCount) { bestCount = shared; best = val }
    }
    return best
  }

  const degreeLabel: Record<number, string> = { 1: "FIRST", 2: "SECOND", 3: "THIRD" }

  const prospects = people.map((p) => {
    const matched = findBestMatch(p.companyName ?? "")
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
      location: p.location ?? "",
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
