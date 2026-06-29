import { supabaseAdmin } from "@/lib/supabase"
import { generateEmailCandidates } from "@/lib/email-guesser"
import { validateEmail } from "@/lib/zerobounce"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { prospect_id } = body

    if (!prospect_id) {
      return Response.json({ error: "prospect_id requerido" }, { status: 400 })
    }

    const { data: p } = await supabaseAdmin
      .from("prospects")
      .select("id, first_name, last_name, company_name, company_domain, linkedin_url, email, email_status, email_provider")
      .eq("id", prospect_id)
      .single()

    if (!p) return Response.json({ error: "Prospecto no encontrado" }, { status: 404 })

    const apolloFirstName = (p.first_name ?? "").split(" ")[0]
    const lastName = p.last_name ?? ""
    const domain = p.company_domain ?? ""

    const candidates = domain
      ? generateEmailCandidates(apolloFirstName, lastName, domain)
      : []

    // Validate first candidate only (to save ZB credits)
    let zbTest: { candidate: string; status: string; subStatus: string | null } | null = null
    if (candidates.length > 0) {
      const { status, subStatus } = await validateEmail(candidates[0])
      zbTest = { candidate: candidates[0], status, subStatus }
    }

    return Response.json({
      prospect: {
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        company_name: p.company_name,
        company_domain: p.company_domain,
        linkedin_url: p.linkedin_url,
        current_email: p.email,
        current_status: p.email_status,
        current_provider: p.email_provider,
      },
      guesser: {
        apollo_first_name_used: apolloFirstName,
        domain_used: domain || "(vacío — guesser no corre)",
        candidates,
        zb_first_candidate: zbTest,
      },
    })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
