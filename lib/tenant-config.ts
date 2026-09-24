import { supabaseAdmin } from "./supabase"

export type TenantConfig = {
  tenant_id: string
  anthropic_api_key: string | null
  apify_token: string | null
  apollo_api_key: string | null
  zerobounce_api_key: string | null
  findymail_api_key: string | null
  prospeo_api_key: string | null
  datagma_api_key: string | null
  hubspot_api_key: string | null
  cold_email_tool: string | null
  cold_email_api_key: string | null
  linkedin_tool: string | null
  linkedin_api_key: string | null
}

export async function getTenantConfig(tenantId: string): Promise<Partial<TenantConfig>> {
  const { data } = await supabaseAdmin
    .from("tenant_configs")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle()
  return (data as Partial<TenantConfig>) ?? {}
}

export async function saveTenantConfig(tenantId: string, config: Partial<Omit<TenantConfig, "tenant_id">>): Promise<void> {
  await supabaseAdmin
    .from("tenant_configs")
    .upsert({ tenant_id: tenantId, ...config, updated_at: new Date().toISOString() }, { onConflict: "tenant_id" })
}
