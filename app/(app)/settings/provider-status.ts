"use server"

export type ProviderStatus = {
  name: string
  label: string
  status: "ok" | "low" | "out" | "unconfigured" | "error"
  credits?: number | null
  detail: string
}

async function checkZeroBounce(): Promise<ProviderStatus> {
  const key = process.env.ZEROBOUNCE_API_KEY
  if (!key) return { name: "zerobounce", label: "ZeroBounce", status: "unconfigured", detail: "API key no configurada" }
  try {
    const res = await fetch(`https://api.zerobounce.net/v2/getcredits?api_key=${key}`)
    if (!res.ok) return { name: "zerobounce", label: "ZeroBounce", status: "error", detail: `HTTP ${res.status}` }
    const data = await res.json()
    const credits = parseInt(data?.Credits ?? data?.credits ?? "-1", 10)
    if (credits === -1) return { name: "zerobounce", label: "ZeroBounce", status: "error", credits: null, detail: "API key inválida" }
    if (credits === 0) return { name: "zerobounce", label: "ZeroBounce", status: "out", credits: 0, detail: "Sin créditos" }
    if (credits < 25) return { name: "zerobounce", label: "ZeroBounce", status: "low", credits, detail: `${credits} créditos restantes` }
    return { name: "zerobounce", label: "ZeroBounce", status: "ok", credits, detail: `${credits.toLocaleString()} créditos` }
  } catch (e) {
    return { name: "zerobounce", label: "ZeroBounce", status: "error", detail: `Error: ${e instanceof Error ? e.message : "desconocido"}` }
  }
}

async function checkHunter(): Promise<ProviderStatus> {
  const key = process.env.HUNTER_API_KEY
  if (!key) return { name: "hunter", label: "Hunter", status: "unconfigured", detail: "API key no configurada" }
  try {
    const res = await fetch(`https://api.hunter.io/v2/account?api_key=${key}`)
    if (!res.ok) return { name: "hunter", label: "Hunter", status: "error", detail: "API key inválida" }
    const data = await res.json()
    const available = data?.data?.requests?.available ?? null
    if (available === 0) return { name: "hunter", label: "Hunter", status: "out", credits: 0, detail: "Sin créditos" }
    if (available !== null && available < 10) return { name: "hunter", label: "Hunter", status: "low", credits: available, detail: `${available} requests restantes` }
    return { name: "hunter", label: "Hunter", status: "ok", credits: available, detail: available !== null ? `${available} requests` : "Configurado" }
  } catch {
    return { name: "hunter", label: "Hunter", status: "error", detail: "Error al consultar" }
  }
}

function checkKey(name: string, label: string, envVar: string): ProviderStatus {
  const key = process.env[envVar]
  if (!key) return { name, label, status: "unconfigured", detail: "API key no configurada" }
  return { name, label, status: "ok", detail: "Configurado" }
}

async function checkApollo(): Promise<ProviderStatus> {
  const key = process.env.APOLLO_API_KEY
  if (!key) return { name: "apollo", label: "Apollo", status: "unconfigured", detail: "API key no configurada" }
  try {
    // credit_usage_stats — créditos de email reveal (0 créditos consumidos)
    const res = await fetch("https://api.apollo.io/api/v1/usage_stats/credit_usage_stats", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "x-api-key": key },
    })

    if (res.status === 401) return { name: "apollo", label: "Apollo", status: "error", detail: "API key inválida" }
    if (res.status === 403) return { name: "apollo", label: "Apollo", status: "ok", detail: "Configurado (key sin scope de stats)" }
    if (!res.ok) return { name: "apollo", label: "Apollo", status: "error", detail: `HTTP ${res.status}` }

    const data = await res.json()

    // Apollo puede devolver distintas estructuras — intentamos las más comunes
    const used    = data?.credits_used    ?? data?.used    ?? data?.consumed ?? null
    const limit   = data?.credits_limit   ?? data?.limit   ?? data?.total    ?? null
    const remaining = data?.credits_remaining ?? data?.remaining ?? data?.left_over ??
      (limit != null && used != null ? limit - used : null)

    if (remaining === null) {
      // No pudimos parsear — al menos la key es válida
      return { name: "apollo", label: "Apollo", status: "ok", detail: "Configurado" }
    }

    if (remaining <= 0) {
      return { name: "apollo", label: "Apollo", status: "out", credits: 0, detail: `Sin créditos${limit ? ` (${used}/${limit} usados)` : ""}` }
    }
    if (remaining < 100) {
      return { name: "apollo", label: "Apollo", status: "low", credits: remaining, detail: `${remaining} créditos restantes` }
    }
    return { name: "apollo", label: "Apollo", status: "ok", credits: remaining, detail: `${remaining} créditos disponibles` }
  } catch {
    return { name: "apollo", label: "Apollo", status: "error", detail: "Error al consultar" }
  }
}

async function checkFindymail(): Promise<ProviderStatus> {
  const key = process.env.FINDYMAIL_API_KEY
  if (!key) return { name: "findymail", label: "FindyEmail", status: "unconfigured", detail: "API key no configurada" }
  try {
    const res = await fetch("https://app.findymail.com/api/credits", {
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    })
    if (!res.ok) return { name: "findymail", label: "FindyEmail", status: "error", detail: `HTTP ${res.status}` }
    const data = await res.json()
    const credits = data?.credits ?? data?.remaining ?? null
    if (credits === 0) return { name: "findymail", label: "FindyEmail", status: "out", credits: 0, detail: "Sin créditos" }
    if (credits !== null && credits < 10) return { name: "findymail", label: "FindyEmail", status: "low", credits, detail: `${credits} créditos restantes` }
    return { name: "findymail", label: "FindyEmail", status: "ok", credits, detail: credits !== null ? `${credits} créditos` : "Configurado" }
  } catch {
    return { name: "findymail", label: "FindyEmail", status: "error", detail: "Error al consultar" }
  }
}

export async function getProviderStatus(): Promise<ProviderStatus[]> {
  const [apollo, zb, hunter, findymail] = await Promise.all([checkApollo(), checkZeroBounce(), checkHunter(), checkFindymail()])
  return [
    apollo,
    findymail,
    checkKey("prospeo", "Prospeo", "PROSPEO_API_KEY"),
    hunter,
    checkKey("datagma", "Datagma", "DATAGMA_API_KEY"),
    zb,
  ]
}
