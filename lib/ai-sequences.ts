import Anthropic from "@anthropic-ai/sdk"
import { readFileSync } from "fs"
import { join } from "path"
import { supabaseAdmin } from "./supabase"
import type { LinkedinSequenceConfig, EmailSequenceConfig } from "@/app/(app)/inbox/actions"
import { DEFAULT_LINKEDIN_CONFIG, DEFAULT_EMAIL_CONFIG } from "@/app/(app)/inbox/actions"

// Product context fallback: read from lib/product-context.md at startup
let PRODUCT_CONTEXT_FALLBACK = ""
try {
  PRODUCT_CONTEXT_FALLBACK = readFileSync(join(process.cwd(), "lib/product-context.md"), "utf-8")
} catch {
  // file may not exist in some environments
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type EmailStep = { step: number; subject: string; body: string }
export type LinkedinStep = { step: number; message: string }
export type Sequences = { email: EmailStep[]; linkedin: LinkedinStep[] }

// ─── Helpers para construir instrucciones desde config ────────────────────────

function buildLinkedinInstructions(liCfg: LinkedinSequenceConfig): string {
  const lines: string[] = []
  lines.push(`- Generá exactamente ${liCfg.step_count} mensajes de LinkedIn`)
  lines.push(`- Paso 1 (solicitud de conexión): máx ${liCfg.step1_chars} caracteres`)
  if (liCfg.step_count > 1) {
    lines.push(`- Pasos 2 en adelante (follow-ups): máx ${liCfg.followup_chars} caracteres cada uno`)
  }

  if (liCfg.prompt_mode === "general" && liCfg.general_prompt) {
    lines.push(`\nInstrucciones adicionales para mensajes de LinkedIn:\n${liCfg.general_prompt}`)
  } else if (liCfg.prompt_mode === "per_step") {
    const stepLines = Array.from({ length: liCfg.step_count }, (_, i) => {
      const stepNum = String(i + 1)
      const inst = liCfg.step_prompts[stepNum]
      return inst ? `  - Paso ${stepNum}: ${inst}` : null
    }).filter(Boolean)
    if (stepLines.length) {
      lines.push(`\nInstrucciones por paso de LinkedIn:\n${stepLines.join("\n")}`)
    }
  }

  return lines.join("\n")
}

function buildEmailInstructions(emailCfg: EmailSequenceConfig): string {
  const lines: string[] = []
  lines.push(`- Generá exactamente ${emailCfg.step_count} pasos de email: paso 1 es el primer contacto, pasos 2-${emailCfg.step_count} son follow-ups`)

  if (emailCfg.prompt_mode === "general" && emailCfg.general_prompt) {
    lines.push(`\nInstrucciones adicionales para emails:\n${emailCfg.general_prompt}`)
  } else if (emailCfg.prompt_mode === "per_step") {
    const stepLines = Array.from({ length: emailCfg.step_count }, (_, i) => {
      const stepNum = String(i + 1)
      const inst = emailCfg.step_prompts[stepNum]
      return inst ? `  - Paso ${stepNum}: ${inst}` : null
    }).filter(Boolean)
    if (stepLines.length) {
      lines.push(`\nInstrucciones por paso de email:\n${stepLines.join("\n")}`)
    }
  }

  return lines.join("\n")
}

function buildEmailJsonTemplate(stepCount: number): string {
  const steps = Array.from({ length: stepCount }, (_, i) => {
    const step = i + 1
    const subject = step === 1 ? "..." : "Re: ..."
    return `    {"step": ${step}, "subject": "${subject}", "body": "..."}`
  }).join(",\n")
  return `[\n${steps}\n  ]`
}

function buildLinkedinJsonTemplate(stepCount: number): string {
  const steps = Array.from({ length: stepCount }, (_, i) =>
    `    {"step": ${i + 1}, "message": "..."}`
  ).join(",\n")
  return `[\n${steps}\n  ]`
}

// ─── generateSequences ────────────────────────────────────────────────────────

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

  // Fetch config from inbox_config
  const { data: config } = await supabaseAdmin
    .from("inbox_config")
    .select("product_context, calendly_link, linkedin_sequence_config, email_sequence_config")
    .eq("id", 1)
    .single()

  const productContext = config?.product_context || PRODUCT_CONTEXT_FALLBACK || "(sin contexto de producto configurado)"
  const calendlyLink = config?.calendly_link ?? ""
  const liCfg: LinkedinSequenceConfig = (config?.linkedin_sequence_config as LinkedinSequenceConfig | null) ?? DEFAULT_LINKEDIN_CONFIG
  const emailCfg: EmailSequenceConfig = (config?.email_sequence_config as EmailSequenceConfig | null) ?? DEFAULT_EMAIL_CONFIG

  const p = prospect as typeof prospect & { accounts: { industry: string | null; headcount_range: string | null; country: string | null } | null }

  const prospectName = (p.full_name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()) || "el prospecto"
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

Instrucciones para emails:
${buildEmailInstructions(emailCfg)}
- Los emails deben tener asunto y cuerpo separados
- Cada secuencia debe ser progresivamente más concisa y directa

Instrucciones para LinkedIn:
${buildLinkedinInstructions(liCfg)}

Instrucciones generales:
- Personalizá usando el nombre, cargo, empresa e industria del prospecto
- Escribí en español (o en el idioma del contexto si se indica)
- Sé concreto, evitá frases genéricas de relleno
- Usá el contexto de research adicional para personalizar al máximo
- NO incluyas placeholders como [NOMBRE] — usá el nombre real del prospecto
- NO uses doble guión (--) en ningún lugar del texto
- NO firmes los emails ni mensajes con nombre propio (sin "Federico", sin "Saludos, X", sin firma de ningún tipo)

Devolvé ÚNICAMENTE un JSON válido sin markdown, sin texto adicional, con este formato exacto:
{
  "email": ${buildEmailJsonTemplate(emailCfg.step_count)},
  "linkedin": ${buildLinkedinJsonTemplate(liCfg.step_count)}
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

// ─── generateLinkedinOnly ─────────────────────────────────────────────────────

export async function generateLinkedinOnly(
  prospectId: string,
  linkedinContext: string
): Promise<LinkedinStep[]> {
  // Fetch prospect + account
  const { data: prospect, error } = await supabaseAdmin
    .from("prospects")
    .select(`
      id, first_name, last_name, full_name, job_title, company_name,
      company_domain, linkedin_url, icp_category, highlights, location,
      accounts ( industry, headcount_range, country )
    `)
    .eq("id", prospectId)
    .single()

  if (error || !prospect) throw new Error("Prospecto no encontrado")

  const { data: config } = await supabaseAdmin
    .from("inbox_config")
    .select("product_context, linkedin_sequence_config")
    .eq("id", 1)
    .single()

  const productContext = config?.product_context || PRODUCT_CONTEXT_FALLBACK || "(sin contexto de producto configurado)"
  const liCfg: LinkedinSequenceConfig = (config?.linkedin_sequence_config as LinkedinSequenceConfig | null) ?? DEFAULT_LINKEDIN_CONFIG

  const p = prospect as typeof prospect & { accounts: { industry: string | null; headcount_range: string | null; country: string | null } | null }
  const prospectName = (p.full_name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()) || "el prospecto"

  const systemPrompt = `Sos un SDR experto en ventas B2B con mucha experiencia en outreach por LinkedIn.
Tu tarea es generar mensajes de LinkedIn para un prospecto específico.

Contexto del producto:
${productContext}

Instrucciones:
${buildLinkedinInstructions(liCfg)}
- Personalizá usando el nombre, cargo, empresa e industria del prospecto
- Escribí en español (o en el idioma del contexto si se indica)
- Sé concreto, nada de frases genéricas
- NO incluyas placeholders como [NOMBRE] — usá el nombre real
- NO uses doble guión (--)
- NO firmes con nombre propio

Devolvé ÚNICAMENTE un JSON válido sin markdown, con este formato exacto:
{
  "linkedin": ${buildLinkedinJsonTemplate(liCfg.step_count)}
}`

  const userPrompt = `Prospecto: ${prospectName}${p.job_title ? `, ${p.job_title}` : ""}${p.company_name ? ` en ${p.company_name}` : ""}
${p.accounts?.industry ? `Industria: ${p.accounts.industry}` : ""}
${p.accounts?.headcount_range ? `Tamaño empresa: ${p.accounts.headcount_range} empleados` : ""}
${p.location ? `Ubicación: ${p.location}` : ""}
${p.icp_category ? `Categoría ICP: ${p.icp_category}` : ""}
${p.highlights ? `LinkedIn highlights: ${p.highlights}` : ""}
${linkedinContext ? `\nContexto adicional para LinkedIn:\n${linkedinContext}` : ""}`

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: userPrompt }],
    system: systemPrompt,
  })

  const text = message.content[0].type === "text" ? message.content[0].text : ""
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("No JSON in response")

  const parsed = JSON.parse(jsonMatch[0]) as { linkedin: LinkedinStep[] }
  return parsed.linkedin
}
