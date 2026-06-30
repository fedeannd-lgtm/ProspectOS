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

export async function getProviderStatus(): Promise<ProviderStatus[]> {
  const [zb, hunter] = await Promise.all([checkZeroBounce(), checkHunter()])
  return [
    checkKey("apollo", "Apollo", "APOLLO_API_KEY"),
    checkKey("findymail", "FindyEmail", "FINDYMAIL_API_KEY"),
    checkKey("prospeo", "Prospeo", "PROSPEO_API_KEY"),
    hunter,
    checkKey("datagma", "Datagma", "DATAGMA_API_KEY"),
    zb,
  ]
}
