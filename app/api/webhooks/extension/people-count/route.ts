import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  try {
    const { repName, industry, count } = await req.json()

    if (!repName || !industry || typeof count !== "number") {
      return NextResponse.json({ error: "Parámetros incompletos" }, { status: 400, headers: CORS })
    }

    const { error } = await supabaseAdmin
      .from("people_search_configs")
      .update({
        last_result_count: count,
        last_count_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("rep_name", repName)
      .eq("industry", industry)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: CORS })
    }

    console.log(`[extension/people-count] ${repName} / ${industry}: ${count} resultados`)
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500, headers: CORS }
    )
  }
}
