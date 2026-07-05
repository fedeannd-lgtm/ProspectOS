import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET() {
  const { data } = await supabaseAdmin
    .from("search_jobs")
    .select("id")
    .eq("job_type", "people_search")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return NextResponse.json({ jobId: null }, { headers: CORS })

  // Mark as running so no other tab picks it up
  await supabaseAdmin
    .from("search_jobs")
    .update({ status: "running" })
    .eq("id", data.id)

  return NextResponse.json({ jobId: data.id }, { headers: CORS })
}
