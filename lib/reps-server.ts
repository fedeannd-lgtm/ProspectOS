import { auth } from "@clerk/nextjs/server"
import { clerkClient } from "@clerk/nextjs/server"
import { REPS, INDUSTRIES } from "./reps"

export async function getTenantReps(): Promise<string[]> {
  try {
    const { orgId } = await auth()
    if (!orgId) return REPS
    const client = await clerkClient()
    const org = await client.organizations.getOrganization({ organizationId: orgId })
    const reps = (org.publicMetadata as Record<string, unknown>)?.reps
    return Array.isArray(reps) && reps.length > 0 ? (reps as string[]) : REPS
  } catch {
    return REPS
  }
}

export async function getTenantIndustries(): Promise<string[]> {
  try {
    const { orgId } = await auth()
    if (!orgId) return INDUSTRIES
    const client = await clerkClient()
    const org = await client.organizations.getOrganization({ organizationId: orgId })
    const industries = (org.publicMetadata as Record<string, unknown>)?.industries
    return Array.isArray(industries) && industries.length > 0 ? (industries as string[]) : INDUSTRIES
  } catch {
    return INDUSTRIES
  }
}
