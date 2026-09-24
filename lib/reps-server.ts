import { supabaseAdmin } from "./supabase"
import { getTenantId } from "./tenant"
import { REPS, INDUSTRIES } from "./reps"

export async function getTenantReps(): Promise<string[]> {
  try {
    const tenantId = await getTenantId()
    const { data } = await supabaseAdmin
      .from("tenant_reps")
      .select("name")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true })
    return data?.map((r: { name: string }) => r.name) ?? []
  } catch {
    return REPS
  }
}

export async function getTenantIndustries(): Promise<string[]> {
  return INDUSTRIES
}
