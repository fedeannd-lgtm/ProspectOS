import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { analyzeReply } from "@/lib/ai-reply"

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret")
  if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // HeyReach webhook format — adapt field names when docs are confirmed
  // Common fields based on HeyReach patterns:
  const eventType = String(body.eventType ?? body.event_type ?? body.type ?? "")
  // Only process reply events (update field names once HeyReach webhook docs are confirmed)
  const REPLY_EVENTS = ["REPLY", "MESSAGE_REPLY", "CONVERSATION_REPLY", "LINKEDIN_REPLY"]
  if (eventType && !REPLY_EVENTS.includes(eventType.toUpperCase())) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const leadId = String(body.leadId ?? body.lead_id ?? "")
  const campaignId = String(body.campaignId ?? body.campaign_id ?? "")
  const replyBody = String(body.messageBody ?? body.message ?? body.body ?? body.replyText ?? "")
  const replyMessageId = String(body.messageId ?? body.message_id ?? "")
  const repliedAt = String(body.createdAt ?? body.created_at ?? body.timestamp ?? new Date().toISOString())
  const senderFirstName = String(body.firstName ?? body.first_name ?? "")
  const senderLastName = String(body.lastName ?? body.last_name ?? "")
  const senderName = [senderFirstName, senderLastName].filter(Boolean).join(" ")
  const profileUrl = String(body.profileUrl ?? body.linkedin_url ?? "")

  if (!replyBody) {
    return NextResponse.json({ error: "Missing reply body" }, { status: 400 })
  }

  // Find matching prospect by LinkedIn URL
  let prospectId: string | null = null
  let dbCampaignId: string | null = null
  if (profileUrl) {
    const { data: prospect } = await supabaseAdmin
      .from("prospects")
      .select("id, campaign_id")
      .ilike("linkedin_url", `%${profileUrl.split("/in/")[1]?.split("/")[0] ?? profileUrl}%`)
      .maybeSingle()
    if (prospect) {
      prospectId = prospect.id
      dbCampaignId = prospect.campaign_id
    }
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("prospect_replies")
    .insert({
      prospect_id: prospectId,
      campaign_id: dbCampaignId,
      source: "heyreach",
      external_lead_id: leadId,
      external_campaign_id: campaignId,
      reply_message_id: replyMessageId,
      replied_at: repliedAt,
      body: replyBody,
      sender_name: senderName || null,
      sender_email: null,
      status: "pending_review",
    })
    .select("id")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  after(async () => {
    await analyzeReply(inserted.id)
  })

  return NextResponse.json({ ok: true, id: inserted.id })
}
