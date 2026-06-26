"use server"

import { revalidatePath } from "next/cache"
import { supabase } from "@/lib/supabase"

export type IcpStat = {
  week_label: string
  industry: string
  score10: number
  score5: number
  score0: number
}

export async function getIcpStats(): Promise<IcpStat[]> {
  const { data, error } = await supabase
    .from("prospects")
    .select("icp_score, campaigns!inner(week_label, industry)")
  if (error) throw new Error(error.message)

  const map = new Map<string, IcpStat>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(data ?? []).forEach((p: any) => {
    const raw = p.campaigns
    const camp: { week_label: string; industry: string } = Array.isArray(raw) ? raw[0] : raw
    if (!camp) return
    const key = `${camp.week_label}||${camp.industry}`
    if (!map.has(key)) map.set(key, { week_label: camp.week_label, industry: camp.industry, score10: 0, score5: 0, score0: 0 })
    const entry = map.get(key)!
    if (p.icp_score === 10) entry.score10++
    else if (p.icp_score === 5) entry.score5++
    else entry.score0++
  })
  return Array.from(map.values())
}

export async function getCampaigns() {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function createCampaign(form: {
  week_label: string
  rep_name: string
  industry: string
  notes: string
}) {
  const { error } = await supabase.from("campaigns").insert(form)
  if (error) throw new Error(error.message)
  revalidatePath("/dashboard")
}

export async function updateCampaign(
  id: string,
  form: { week_label: string; rep_name: string; industry: string; notes: string }
) {
  const { error } = await supabase.from("campaigns").update(form).eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/dashboard")
}

export async function deleteCampaign(id: string) {
  const { error } = await supabase.from("campaigns").delete().eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/dashboard")
}
