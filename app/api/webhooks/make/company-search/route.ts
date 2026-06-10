import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

// Escenario 1 de Make: arrancó Apify y devuelve el datasetId para extracción posterior
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { jobId, datasetId } = body as { jobId: string; datasetId: string }

  if (!jobId || !datasetId) {
    return NextResponse.json({ error: "jobId y datasetId requeridos" }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from("search_jobs")
    .update({ dataset_id: datasetId })
    .eq("id", jobId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
