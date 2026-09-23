import { auth } from "@clerk/nextjs/server"
import { clerkClient } from "@clerk/nextjs/server"

const DEFAULT_REPS = ["Alu", "Fede", "Guido", "Suva", "Jess"]
const DEFAULT_INDUSTRIES = [
  "Retail & Comercio", "Manufactura", "Finance & Insurance", "Agro & Energy",
  "Construcción", "BPO & Professional Services", "Health & Entertainment", "Consulting & Telco",
]

// Static fallbacks — used in client components and dev environment
export const REPS: string[] = process.env.NEXT_PUBLIC_REPS
  ? process.env.NEXT_PUBLIC_REPS.split(",").map((r) => r.trim()).filter(Boolean)
  : DEFAULT_REPS

export const INDUSTRIES: string[] = process.env.NEXT_PUBLIC_INDUSTRIES
  ? process.env.NEXT_PUBLIC_INDUSTRIES.split(",").map((i) => i.trim()).filter(Boolean)
  : DEFAULT_INDUSTRIES

// Async versions that read from the active Clerk org's publicMetadata.
// Use these in server components/actions; pass the result as props to client components.
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
