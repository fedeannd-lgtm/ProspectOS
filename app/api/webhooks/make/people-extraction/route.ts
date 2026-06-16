import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

type ApifyPerson = {
  firstName?: string
  lastName?: string
  fullName?: string
  title?: string
  profileUrl?: string
  companyName?: string
  isPremium?: boolean
  degree?: string
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { jobId, people = [] } = body as { jobId: string; people: ApifyPerson[] }

  if (!jobId) {
    return NextResponse.json({ error: "jobId requerido" }, { status: 400 })
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from("search_jobs")
    .select("campaign_id")
    .eq("id", jobId)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: "Job no encontrado" }, { status: 404 })
  }

  const prospects = (people as ApifyPerson[]).map((p) => ({
    campaign_id: job.campaign_id as string,
    first_name: (p.firstName ?? "") as string,
    last_name: (p.lastName ?? "") as string,
    full_name: (p.fullName ?? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim()) as string,
    job_title: (p.title ?? "") as string,
    linkedin_url: (p.profileUrl ?? "") as string,
    company_name: (p.companyName ?? "") as string,
    is_premium: p.isPremium ?? false,
    connection_degree: (p.degree ?? "") as string,
  }))

  if (prospects.length > 0) {
    await supabaseAdmin.from("prospects").insert(prospects)
  }

  await supabaseAdmin
    .from("search_jobs")
    .update({
      status: "completed",
      results_count: prospects.length,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId)

  await supabaseAdmin
    .from("campaigns")
    .update({ prospects_found: prospects.length })
    .eq("id", job.campaign_id)

  return NextResponse.json({ ok: true, saved: prospects.length })
}
