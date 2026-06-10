"use server"

import { revalidatePath } from "next/cache"
import { supabase } from "@/lib/supabase"

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
