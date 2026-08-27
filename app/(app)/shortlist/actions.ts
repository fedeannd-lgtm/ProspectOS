"use server"

import { revalidatePath } from "next/cache"
import { supabase, supabaseAdmin } from "@/lib/supabase"
import { generateSequences, type Sequences } from "@/lib/ai-sequences"
import { addLeadsToSmartlead, fetchSmartleadCampaigns } from "@/lib/smartlead"

export { fetchSmartleadCampaigns }

export type ShortlistedProspect = {
  id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  job_title: string | null
  company_name: string | null
  company_domain: string | null
  linkedin_url: string | null
  email: string | null
  icp_score: number | null
  icp_category: string | null
  os_score: number | null
  highlights: string | null
  location: string | null
  phone: string | null
  apollo_id: string | null
  accounts: { industry: string | null; headcount_range: string | null } | null
  campaigns: { rep_name: string | null; week_label: string | null } | null
  shortlist_status: string | null
  latest_sequences: {
    id: string
    research_context: string | null
    sequences: Sequences | null
    generated_at: string | null
  } | null
}

export async function getShortlistedProspects(): Promise<ShortlistedProspect[]> {
  const { data, error } = await supabase
    .from("prospects")
    .select(`
      id, first_name, last_name, full_name, job_title, company_name,
      company_domain, linkedin_url, email, icp_score, icp_category,
      os_score, highlights, location, phone, apollo_id, shortlist_status,
      accounts ( industry, headcount_range ),
      campaigns ( rep_name, week_label )
    `)
    .eq("shortlisted", true)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)

  const prospects = (data ?? []) as unknown as ShortlistedProspect[]

  // For each prospect, fetch the latest shortlist_sequences row
  if (prospects.length === 0) return prospects

  const ids = prospects.map((p) => p.id)
  const { data: seqData } = await supabase
    .from("shortlist_sequences")
    .select("id, prospect_id, research_context, sequences, generated_at")
    .in("prospect_id", ids)
    .order("generated_at", { ascending: false })

  // Map latest sequences per prospect
  const seqMap = new Map<string, typeof seqData extends (infer T)[] | null ? T : never>()
  for (const seq of seqData ?? []) {
    if (!seqMap.has(seq.prospect_id)) seqMap.set(seq.prospect_id, seq)
  }

  return prospects.map((p) => ({
    ...p,
    latest_sequences: (seqMap.get(p.id) ?? null) as ShortlistedProspect["latest_sequences"],
  }))
}

export async function removeFromShortlist(prospectId: string): Promise<void> {
  await supabaseAdmin
    .from("prospects")
    .update({ shortlisted: false })
    .eq("id", prospectId)
  revalidatePath("/shortlist")
}

export async function generateAndSaveSequences(
  prospectId: string,
  researchContext: string
): Promise<{ sequences: Sequences } | { error: string }> {
  try {
    const sequences = await generateSequences(prospectId, researchContext)
    revalidatePath("/shortlist")
    return { sequences }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error generando secuencias" }
  }
}

export async function saveEditedSequences(prospectId: string, sequences: Sequences): Promise<void> {
  // Update the most recent shortlist_sequences row for this prospect
  const { data } = await supabaseAdmin
    .from("shortlist_sequences")
    .select("id")
    .eq("prospect_id", prospectId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .single()
  if (data?.id) {
    await supabaseAdmin
      .from("shortlist_sequences")
      .update({ sequences })
      .eq("id", data.id)
  }
  revalidatePath("/shortlist")
}

export async function pushToSmartlead(
  prospectId: string,
  campaignId: string
): Promise<{ ok: boolean; error?: string }> {
  const [{ data: prospect }, { data: seq }] = await Promise.all([
    supabaseAdmin
      .from("prospects")
      .select("first_name, last_name, full_name, email, company_name, linkedin_url")
      .eq("id", prospectId)
      .single(),
    supabaseAdmin
      .from("shortlist_sequences")
      .select("sequences")
      .eq("prospect_id", prospectId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .single(),
  ])

  if (!prospect?.email) return { ok: false, error: "El prospecto no tiene email guardado" }

  const emailSteps = (seq?.sequences as Sequences | null)?.email ?? []
  const custom_fields: Record<string, string> = {}
  emailSteps.slice(0, 4).forEach((step, i) => {
    custom_fields[`Mail${i + 1}`] = step.body
  })

  const nameParts = (prospect.full_name ?? "").split(" ")
  const result = await addLeadsToSmartlead(campaignId, [{
    email: prospect.email,
    first_name: prospect.first_name ?? nameParts[0] ?? undefined,
    last_name: prospect.last_name ?? (nameParts.slice(1).join(" ") || undefined),
    company_name: prospect.company_name ?? undefined,
    linkedin_profile: prospect.linkedin_url ?? undefined,
    custom_fields,
  }])

  if (result.error) return { ok: false, error: result.error }
  if (result.success === 0) return { ok: false, error: "Smartlead no aceptó el lead (¿ya existe en la campaña?)" }

  // Mark as sent
  await supabaseAdmin.from("prospects").update({ shortlist_status: "Enviado" }).eq("id", prospectId)
  revalidatePath("/shortlist")
  return { ok: true }
}

export async function updateShortlistStatus(prospectId: string, status: string): Promise<void> {
  await supabaseAdmin
    .from("prospects")
    .update({ shortlist_status: status })
    .eq("id", prospectId)
  revalidatePath("/shortlist")
}

export async function addToShortlist(prospectIds: string[]): Promise<void> {
  await supabaseAdmin
    .from("prospects")
    .update({ shortlisted: true })
    .in("id", prospectIds)
  revalidatePath("/shortlist")
  revalidatePath("/enrichment")
}

export type ManualProspectInput = {
  full_name: string
  job_title?: string
  company_name?: string
  company_domain?: string
  email?: string
  linkedin_url?: string
  phone?: string
  location?: string
  notes?: string
}

export async function addManualProspect(input: ManualProspectInput): Promise<{ id: string } | { error: string }> {
  const parts = input.full_name.trim().split(/\s+/)
  const first_name = parts[0] ?? ""
  const last_name = parts.slice(1).join(" ") || ""

  const { data, error } = await supabaseAdmin
    .from("prospects")
    .insert({
      full_name: input.full_name.trim(),
      first_name,
      last_name,
      job_title: input.job_title || null,
      company_name: input.company_name || null,
      company_domain: input.company_domain || null,
      email: input.email || null,
      linkedin_url: input.linkedin_url || null,
      phone: input.phone || null,
      location: input.location || null,
      highlights: input.notes || null,
      shortlisted: true,
      shortlist_status: "Pendiente",
    })
    .select("id")
    .single()

  if (error) return { error: error.message }
  revalidatePath("/shortlist")
  return { id: data.id }
}
