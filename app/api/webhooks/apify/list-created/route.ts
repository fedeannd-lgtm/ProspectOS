import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { getDatasetItems } from "@/lib/apify"
import { updateAccountListInUrl } from "@/lib/sales-nav-lists"

type ApifyWebhookBody = {
  eventType: string
  resource: { id: string; defaultDatasetId: string; status: string }
}

type ListResult = { listId: string; listName: string; companiesCount: number }

export async function POST(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId")
  if (!jobId) return NextResponse.json({ error: "jobId requerido" }, { status: 400 })

  const body = await req.json() as ApifyWebhookBody
  const { resource } = body

  if (resource.status === "FAILED") {
    console.error("[list-created] Actor failed for job", jobId)
    return NextResponse.json({ ok: true })
  }

  const items = await getDatasetItems<ListResult>(resource.defaultDatasetId)
  const result = items[0]
  if (!result?.listId) {
    console.error("[list-created] No listId in dataset", items)
    return NextResponse.json({ error: "No listId" }, { status: 422 })
  }

  const { data: job } = await supabaseAdmin
    .from("search_jobs")
    .select("campaign_id, campaigns(rep_name, industry)")
    .eq("id", jobId)
    .single()

  if (!job) return NextResponse.json({ error: "Job no encontrado" }, { status: 404 })

  const raw = job.campaigns
  const campaign = (Array.isArray(raw) ? raw[0] : raw) as { rep_name: string; industry: string } | null
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })

  // Fetch current people search URL
  const { data: config } = await supabaseAdmin
    .from("people_search_configs")
    .select("base_url")
    .eq("rep_name", campaign.rep_name)
    .eq("industry", campaign.industry)
    .maybeSingle()

  if (!config?.base_url) {
    console.warn("[list-created] No people_search_config for", campaign.rep_name, campaign.industry)
    return NextResponse.json({ ok: true, warning: "No people_search_config found — URL not updated" })
  }

  const updatedUrl = updateAccountListInUrl(config.base_url, result.listId, result.listName)

  await supabaseAdmin
    .from("people_search_configs")
    .update({ base_url: updatedUrl, updated_at: new Date().toISOString() })
    .eq("rep_name", campaign.rep_name)
    .eq("industry", campaign.industry)

  console.log(`[list-created] Updated people_search_config for ${campaign.rep_name}/${campaign.industry} with list ${result.listId}`)

  return NextResponse.json({ ok: true, listId: result.listId, listName: result.listName })
}
