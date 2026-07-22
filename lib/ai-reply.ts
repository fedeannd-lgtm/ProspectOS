import Anthropic from "@anthropic-ai/sdk"
import { supabaseAdmin } from "./supabase"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type ReplyContext = {
  id: string
  body: string
  subject: string | null
  source: string
  thread_history: unknown
  sender_name: string | null
  sender_email: string | null
  prospects: {
    full_name: string | null
    first_name: string | null
    last_name: string | null
    job_title: string | null
    company_name: string | null
    icp_category: string | null
    highlights: string | null
    linkedin_url: string | null
    accounts: { industry: string | null } | null
  } | null
}

function formatThread(history: unknown): string {
  if (!history || !Array.isArray(history)) return ""
  return history
    .map((msg: Record<string, unknown>) => {
      const type = String(msg.type ?? msg.message_type ?? "")
      const body = String(msg.email_body ?? msg.body ?? "")
      const label = type === "SENT" ? "Enviado" : "Respuesta"
      return `[${label}]: ${body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500)}`
    })
    .join("\n\n")
}

export async function analyzeReply(replyId: string): Promise<void> {
  const { data: reply, error } = await supabaseAdmin
    .from("prospect_replies")
    .select(`
      id, body, subject, source, thread_history, sender_name, sender_email,
      prospects (
        full_name, first_name, last_name, job_title, company_name,
        icp_category, highlights, linkedin_url,
        accounts ( industry )
      )
    `)
    .eq("id", replyId)
    .single()

  if (error || !reply) return

  const r = reply as unknown as ReplyContext
  const p = r.prospects

  const { data: config } = await supabaseAdmin
    .from("inbox_config")
    .select("product_context, calendly_link")
    .eq("id", 1)
    .single()

  const productContext = config?.product_context ?? "(sin contexto de producto configurado)"
  const calendlyLink = config?.calendly_link ?? ""

  const prospectName = p?.full_name ?? `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() ?? r.sender_name ?? "el prospecto"
  const jobTitle = p?.job_title ?? ""
  const company = p?.company_name ?? ""
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const industry = (p?.accounts as any)?.industry ?? ""
  const icpCategory = p?.icp_category ?? ""
  const highlights = p?.highlights ?? ""
  const threadText = formatThread(r.thread_history)

  const systemPrompt = `Sos un SDR experto en ventas B2B.
Analizás respuestas de prospectos y generás borradores de respuesta en nombre del equipo de ventas.

Contexto del producto:
${productContext}

Reglas:
- Si el prospecto está interesado o pide más info: proponé una reunión incluyendo este link de Calendly: ${calendlyLink || "(configurar link de Calendly en Settings > Inbox)"}
- Si no está interesado: manejá la objeción levantando pain points de su industria con el contexto del producto
- Si tiene una pregunta específica: respondé con la info más relevante para su industria y cargo
- Escribí siempre en el mismo idioma que usó el prospecto
- Sé conciso, profesional y directo — nada de frases de relleno
- NO repitas el asunto del email en el cuerpo
- Personalizá usando el nombre, cargo e industria del prospecto`

  const userPrompt = `Prospecto: ${prospectName}${jobTitle ? `, ${jobTitle}` : ""}${company ? ` en ${company}` : ""}
${industry ? `Industria: ${industry}` : ""}
${icpCategory ? `Categoría ICP: ${icpCategory}` : ""}
${highlights ? `LinkedIn highlights: ${highlights}` : ""}

${threadText ? `Historial de conversación:\n${threadText}\n\n` : ""}Última respuesta recibida:
${r.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}

Devolvé ÚNICAMENTE un JSON válido con este formato exacto (sin markdown, sin texto adicional):
{"intent":"interested","reasoning":"una línea","draft":"el borrador completo"}`

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    })

    const text = message.content[0].type === "text" ? message.content[0].text : ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("No JSON in response")

    const parsed = JSON.parse(jsonMatch[0]) as { intent: string; reasoning: string; draft: string }

    await supabaseAdmin
      .from("prospect_replies")
      .update({
        intent: parsed.intent,
        ai_reasoning: parsed.reasoning,
        ai_draft: parsed.draft,
        status: "draft_ready",
      })
      .eq("id", replyId)
  } catch {
    // If AI fails, leave status as pending_review so SDR can write manually
  }
}
