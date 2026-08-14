import Anthropic from "@anthropic-ai/sdk"
import { supabaseAdmin } from "./supabase"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type EmailStep = { step: number; subject: string; body: string }
export type LinkedinStep = { step: number; message: string }
export type Sequences = { email: EmailStep[]; linkedin: LinkedinStep[] }

export async function generateSequences(
  prospectId: string,
  researchContext: string
): Promise<Sequences> {
  // Fetch prospect + account
  const { data: prospect, error } = await supabaseAdmin
    .from("prospects")
    .select(`
      id, first_name, last_name, full_name, job_title, company_name,
      company_domain, linkedin_url, icp_category, icp_score, os_score,
      highlights, location, email,
      accounts ( industry, headcount_range, country )
    `)
    .eq("id", prospectId)
    .single()

  if (error || !prospect) throw new Error("Prospecto no encontrado")

  // Fetch product context from inbox_config
  const { data: config } = await supabaseAdmin
    .from("inbox_config")
    .select("product_context, calendly_link")
    .eq("id", 1)
    .single()

  const productContext = config?.product_context ?? "(sin contexto de producto configurado)"
  const calendlyLink = config?.calendly_link ?? ""

  const p = prospect as typeof prospect & { accounts: { industry: string | null; headcount_range: string | null; country: string | null } | null }

  const prospectName = p.full_name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "el prospecto"
  const jobTitle = p.job_title ?? ""
  const company = p.company_name ?? ""
  const domain = p.company_domain ?? ""
  const industry = p.accounts?.industry ?? ""
  const headcount = p.accounts?.headcount_range ?? ""
  const icpCategory = p.icp_category ?? ""
  const highlights = p.highlights ?? ""
  const location = p.location ?? ""

  const systemPrompt = `Sos un SDR experto en ventas B2B con mucha experiencia en outreach personalizado.
Tu tarea es generar secuencias de contacto para un prospecto específico, basándote en su perfil y en el contexto del producto.

Contexto del producto:
${productContext}

${calendlyLink ? `Link de Calendly para reuniones: ${calendlyLink}` : ""}

Instrucciones para las secuencias:
- Generá 5 pasos de email: paso 1 es el primer contacto, pasos 2-5 son follow-ups sucesivos
- Generá 5 mensajes de LinkedIn: paso 1 es el primer mensaje, pasos 2-5 son follow-ups
- Cada secuencia debe ser progresivamente más concisa y directa
- Personalizá usando el nombre, cargo, empresa e industria del prospecto
- Los emails deben tener asunto y cuerpo separados
- Los mensajes de LinkedIn deben ser cortos (máx 300 caracteres para conexión, 150 para follow-ups)
- Escribí en español (o en el idioma del contexto si se indica)
- Sé concreto, evitá frases genéricas de relleno
- Usá el contexto de research adicional para personalizar al máximo
- NO incluyas placeholders como [NOMBRE] — usá el nombre real del prospecto

Devolvé ÚNICAMENTE un JSON válido sin markdown, sin texto adicional, con este formato exacto:
{
  "email": [
    {"step": 1, "subject": "...", "body": "..."},
    {"step": 2, "subject": "Re: ...", "body": "..."},
    {"step": 3, "subject": "Re: ...", "body": "..."},
    {"step": 4, "subject": "Re: ...", "body": "..."},
    {"step": 5, "subject": "Re: ...", "body": "..."}
  ],
  "linkedin": [
    {"step": 1, "message": "..."},
    {"step": 2, "message": "..."},
    {"step": 3, "message": "..."},
    {"step": 4, "message": "..."},
    {"step": 5, "message": "..."}
  ]
}`

  const userPrompt = `Prospecto: ${prospectName}${jobTitle ? `, ${jobTitle}` : ""}${company ? ` en ${company}` : ""}
${domain ? `Dominio: ${domain}` : ""}
${industry ? `Industria: ${industry}` : ""}
${headcount ? `Tamaño empresa: ${headcount} empleados` : ""}
${location ? `Ubicación: ${location}` : ""}
${icpCategory ? `Categoría ICP: ${icpCategory}` : ""}
${highlights ? `LinkedIn highlights: ${highlights}` : ""}
${researchContext ? `\nResearch adicional sobre este prospecto:\n${researchContext}` : ""}`

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: userPrompt }],
    system: systemPrompt,
  })

  const text = message.content[0].type === "text" ? message.content[0].text : ""
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("No JSON in response")

  const sequences = JSON.parse(jsonMatch[0]) as Sequences

  // Save to shortlist_sequences
  await supabaseAdmin
    .from("shortlist_sequences")
    .insert({
      prospect_id: prospectId,
      research_context: researchContext || null,
      sequences,
      model_used: "claude-sonnet-4-6",
      generated_at: new Date().toISOString(),
    })

  return sequences
}
