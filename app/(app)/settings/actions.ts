"use server"

import { revalidatePath } from "next/cache"
import { supabase, supabaseAdmin } from "@/lib/supabase"

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
