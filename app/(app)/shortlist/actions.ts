"use server"

import { revalidatePath } from "next/cache"
import { supabase, supabaseAdmin } from "@/lib/supabase"
import { generateSequences, type Sequences } from "@/lib/ai-sequences"

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
      os_score, highlights, location, phone, apollo_id,
      accounts ( industry, headcount_range )
    `)
    .eq("shortlisted", true)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)

  const prospects = (data ?? []) as ShortlistedProspect[]

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

export async function addToShortlist(prospectIds: string[]): Promise<void> {
  await supabaseAdmin
    .from("prospects")
    .update({ shortlisted: true })
    .in("id", prospectIds)
  revalidatePath("/shortlist")
  revalidatePath("/enrichment")
}
