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
  const campaignId = req.nextUrl.searchParams.get("campaignId")

  if (!jobId && !campaignId) {
    return NextResponse.json({ error: "jobId o campaignId requerido" }, { status: 400 })
  }

  const body = await req.json() as ApifyWebhookBody
  const { resource } = body

  if (resource.status === "FAILED") {
    console.error("[list-created] Actor failed for", jobId ?? campaignId)
    return NextResponse.json({ ok: true })
  }

  const items = await getDatasetItems<ListResult>(resource.defaultDatasetId)
  const result = items[0]
  if (!result?.listId) {
    console.error("[list-created] No listId in dataset", items)
    return NextResponse.json({ error: "No listId" }, { status: 422 })
  }

  // Resolve campaignId + rep/industry
  let resolvedCampaignId: string
  let repName: string
  let industry: string

  if (campaignId) {
    // Direct campaignId path (triggered from campaign detail page)
    const { data: camp } = await supabaseAdmin
      .from("campaigns")
      .select("id, rep_name, industry")
      .eq("id", campaignId)
      .single()
    if (!camp) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 })
    resolvedCampaignId = camp.id
    repName = camp.rep_name
    industry = camp.industry
  } else {
    // jobId path (legacy — from company search job card button)
    const { data: job } = await supabaseAdmin
      .from("search_jobs")
      .select("campaign_id, campaigns(rep_name, industry)")
      .eq("id", jobId!)
      .single()
    if (!job) return NextResponse.json({ error: "Job no encontrado" }, { status: 404 })
    const raw = job.campaigns
    const camp = (Array.isArray(raw) ? raw[0] : raw) as { rep_name: string; industry: string } | null
    if (!camp) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 })
    resolvedCampaignId = job.campaign_id
    repName = camp.rep_name
    industry = camp.industry
  }

  // Save list ID + name to the campaign
  await supabaseAdmin
    .from("campaigns")
    .update({ list_id: result.listId, list_name: result.listName })
    .eq("id", resolvedCampaignId)

  // Update people_search_config list metadata for this rep+industry
  const { data: config } = await supabaseAdmin
    .from("people_search_configs")
    .select("base_url")
    .eq("rep_name", repName)
    .eq("industry", industry)
    .maybeSingle()

  if (config?.base_url) {
    const updatedUrl = updateAccountListInUrl(config.base_url, result.listId, result.listName)
    await supabaseAdmin
      .from("people_search_configs")
      .update({ list_id: result.listId, list_name: result.listName, base_url: updatedUrl, updated_at: new Date().toISOString() })
      .eq("rep_name", repName)
      .eq("industry", industry)
  } else {
    console.warn("[list-created] No people_search_config for", repName, industry)
  }

  console.log(`[list-created] List ${result.listId} saved for campaign ${resolvedCampaignId} (${repName}/${industry})`)
  return NextResponse.json({ ok: true, listId: result.listId, listName: result.listName })
}
