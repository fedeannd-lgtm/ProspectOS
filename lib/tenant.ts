import { auth } from "@clerk/nextjs/server"

/**
 * Returns the active Clerk orgId as the tenant_id for all DB queries.
 * Throws if the user has no active organization — middleware should prevent this.
 */
export async function getTenantId(): Promise<string> {
  const { orgId } = await auth()
  if (!orgId) throw new Error("No hay workspace activo. Seleccioná una organización primero.")
  return orgId
}
