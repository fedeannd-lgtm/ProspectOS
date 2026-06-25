"use server"

import { revalidatePath } from "next/cache"
import { supabase, supabaseAdmin } from "@/lib/supabase"

export type SavedUrl = {
  id: string
  rep_name: string
  industry: string
  url_type: "company_search" | "people_search"
  url: string
  label: string | null
  created_at: string
}

export async function getSavedUrls(): Promise<SavedUrl[]> {
  const { data, error } = await supabase
    .from("saved_urls")
    .select("*")
    .order("rep_name")
    .order("industry")
    .order("url_type")
    .order("created_at")
  if (error) throw new Error(error.message)
  return (data ?? []) as SavedUrl[]
}

export async function createSavedUrl(payload: Omit<SavedUrl, "id" | "created_at">): Promise<SavedUrl> {
  const { data, error } = await supabaseAdmin.from("saved_urls").insert(payload).select().single()
  if (error) throw new Error(error.message)
  revalidatePath("/settings")
  return data as SavedUrl
}

export async function deleteSavedUrl(id: string) {
  const { error } = await supabaseAdmin.from("saved_urls").delete().eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/settings")
}

const REPS = ["Alu", "Fede", "Guido", "Suva", "Jess"]

export async function getRepConfigs() {
  const { data, error } = await supabase
    .from("rep_configs")
    .select("rep_name, linkedin_cookie, updated_at")
    .order("rep_name")
  if (error) throw new Error(error.message)

  // Merge stored configs with known reps so all 5 always appear
  return REPS.map((rep) => {
    const stored = data?.find((r) => r.rep_name === rep)
    return {
      rep_name: rep,
      linkedin_cookie: stored?.linkedin_cookie ?? null,
      updated_at: stored?.updated_at ?? null,
    }
  })
}

export async function upsertRepCookie(repName: string, cookie: string) {
  const { error } = await supabaseAdmin
    .from("rep_configs")
    .upsert(
      { rep_name: repName, linkedin_cookie: cookie, updated_at: new Date().toISOString() },
      { onConflict: "rep_name" }
    )
  if (error) throw new Error(error.message)
  revalidatePath("/settings")
}
