import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { analyzeReply } from "@/lib/ai-reply"

export async function POST(req: NextRequest) {
  // Verify webhook secret
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

  // Smartlead sends different event types — only handle replies
  const eventType = String(body.event_type ?? body.type ?? "")
  if (eventType && eventType !== "EMAIL_REPLY" && eventType !== "REPLY") {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const leadEmail = String(body.lead_email ?? body.email ?? "")
  const leadId = String(body.lead_id ?? "")
  const campaignId = String(body.campaign_id ?? "")
  const replyBody = String(body.email_body ?? body.body ?? body.reply_text ?? "")
  const replyMessageId = String(body.reply_message_id ?? body.message_id ?? "")
  const repliedAt = String(body.created_at ?? body.timestamp ?? new Date().toISOString())
  const subject = String(body.subject ?? body.email_subject ?? "")
  const senderName = String(body.first_name ?? body.sender_name ?? "") + (body.last_name ? ` ${body.last_name}` : "")

  if (!replyBody) {
    return NextResponse.json({ error: "Missing reply body" }, { status: 400 })
  }

  // Find matching prospect by email
  let prospectId: string | null = null
  let dbCampaignId: string | null = null
  if (leadEmail) {
    const { data: prospect } = await supabaseAdmin
      .from("prospects")
      .select("id, campaign_id")
      .eq("email", leadEmail)
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
      source: "smartlead",
      external_lead_id: leadId,
      external_campaign_id: campaignId,
      reply_message_id: replyMessageId,
      replied_at: repliedAt,
      subject: subject || null,
      body: replyBody,
      sender_name: senderName.trim() || null,
      sender_email: leadEmail || null,
      status: "pending_review",
    })
    .select("id")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Trigger AI analysis after response is sent
  after(async () => {
    await analyzeReply(inserted.id)
  })

  return NextResponse.json({ ok: true, id: inserted.id })
}
