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
    // Lightweight match call — sin reveal_personal_emails no consume créditos de email
    const res = await fetch("https://api.apollo.io/v1/people/match", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "X-Api-Key": key },
      body: JSON.stringify({ api_key: key, first_name: "ping", organization_name: "ping" }),
    })

    if (res.status === 401) return { name: "apollo", label: "Apollo", status: "error", detail: "API key inválida" }

    // Apollo devuelve headers de uso en todas las respuestas
    const monthlyUsage  = parseInt(res.headers.get("x-monthly-usage")   ?? "-1", 10)
    const monthlyLimit  = parseInt(res.headers.get("x-monthly-limit")   ?? "-1", 10)
    const dailyUsage    = parseInt(res.headers.get("x-24-hour-usage")   ?? "-1", 10)
    const dailyLimit    = parseInt(res.headers.get("x-24-hour-limit")   ?? "-1", 10)

    // Detectar sin créditos por mensaje en body (422)
    if (res.status === 422) {
      const body = await res.json().catch(() => ({}))
      const msg = String(body?.message ?? body?.error ?? "")
      if (msg.toLowerCase().includes("credit") || msg.toLowerCase().includes("limit")) {
        return { name: "apollo", label: "Apollo", status: "out", credits: 0, detail: "Sin créditos disponibles" }
      }
    }

    if (dailyLimit > 0 && dailyUsage >= dailyLimit) {
      return { name: "apollo", label: "Apollo", status: "out", credits: 0, detail: `Límite diario alcanzado (${dailyUsage}/${dailyLimit})` }
    }
    if (monthlyLimit > 0 && monthlyUsage >= monthlyLimit) {
      return { name: "apollo", label: "Apollo", status: "out", credits: 0, detail: `Límite mensual alcanzado (${monthlyUsage}/${monthlyLimit})` }
    }

    const remaining = dailyLimit > 0 ? dailyLimit - dailyUsage : (monthlyLimit > 0 ? monthlyLimit - monthlyUsage : null)
    if (remaining !== null && remaining < 20) {
      return { name: "apollo", label: "Apollo", status: "low", credits: remaining, detail: `${remaining} créditos restantes` }
    }

    const detail = dailyLimit > 0
      ? `${dailyUsage}/${dailyLimit} usados hoy`
      : monthlyLimit > 0
        ? `${monthlyUsage}/${monthlyLimit} usados este mes`
        : "Configurado"

    return { name: "apollo", label: "Apollo", status: "ok", credits: remaining, detail }
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
