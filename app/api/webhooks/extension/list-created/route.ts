import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { updateAccountListInUrl } from "@/lib/sales-nav-lists"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const listId = searchParams.get("listId")
  const listName = searchParams.get("listName")
  const campaignId = searchParams.get("campaignId")
  const added = searchParams.get("added") ?? "0"
  const failed = searchParams.get("failed") ?? "0"

  if (!listId || !listName || !campaignId) {
    return htmlResponse("❌ Parámetros incompletos", "error")
  }

  // Save list to campaign
  const { data: campaign, error: campError } = await supabaseAdmin
    .from("campaigns")
    .update({ list_id: listId, list_name: listName })
    .eq("id", campaignId)
    .select("rep_name, industry")
    .single()

  if (campError) {
    return htmlResponse(`❌ Error guardando lista: ${campError.message}`, "error")
  }

  // Update people_search_config list metadata
  const { data: config } = await supabaseAdmin
    .from("people_search_configs")
    .select("base_url")
    .eq("rep_name", campaign.rep_name)
    .eq("industry", campaign.industry)
    .maybeSingle()

  if (config?.base_url) {
    const updatedUrl = updateAccountListInUrl(config.base_url, listId, listName)
    await supabaseAdmin
      .from("people_search_configs")
      .update({ list_id: listId, list_name: listName, base_url: updatedUrl, updated_at: new Date().toISOString() })
      .eq("rep_name", campaign.rep_name)
      .eq("industry", campaign.industry)
  }

  console.log(`[extension/list-created] Campaign ${campaignId}: list ${listId} saved (${added} added, ${failed} failed)`)

  return htmlResponse(
    `✅ Lista "${listName}" guardada en ProspectOS\n${added} empresas agregadas${Number(failed) > 0 ? ` · ${failed} fallaron` : ""}`,
    "success",
    campaignId
  )
}

function htmlResponse(message: string, type: "success" | "error", campaignId?: string) {
  const isSuccess = type === "success"
  const lines = message.split("\n")
  const redirectScript = isSuccess && campaignId
    ? `<script>setTimeout(() => { window.location.href = '/campaigns/${campaignId}'; }, 2000);</script>`
    : ""

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ProspectOS</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; background: #f9fafb;
    }
    .card {
      background: white; border-radius: 12px; padding: 32px 40px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08); text-align: center; max-width: 420px;
    }
    .icon { font-size: 40px; margin-bottom: 16px; }
    .title { font-size: 18px; font-weight: 600; color: ${isSuccess ? "#16a34a" : "#dc2626"}; margin-bottom: 8px; }
    .subtitle { font-size: 14px; color: #6b7280; }
    .redirect { font-size: 12px; color: #9ca3af; margin-top: 16px; }
  </style>
  ${redirectScript}
</head>
<body>
  <div class="card">
    <div class="icon">${isSuccess ? "✅" : "❌"}</div>
    <div class="title">${lines[0]}</div>
    ${lines[1] ? `<div class="subtitle">${lines[1]}</div>` : ""}
    ${isSuccess ? `<div class="redirect">Volviendo a la campaña…</div>` : ""}
  </div>
</body>
</html>`

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}
