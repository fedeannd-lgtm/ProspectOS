"use server"

import { getTenantApiKeys } from "./actions"

export type ProviderStatus = {
  name: string
  label: string
  status: "ok" | "low" | "out" | "unconfigured" | "error"
  credits?: number | null
  detail: string
}

type Keys = {
  apollo_api_key: string | null
  zerobounce_api_key: string | null
  findymail_api_key: string | null
  prospeo_api_key: string | null
  datagma_api_key: string | null
}

async function checkZeroBounce(key: string | null): Promise<ProviderStatus> {
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

async function checkApollo(key: string | null): Promise<ProviderStatus> {
  if (!key) return { name: "apollo", label: "Apollo", status: "unconfigured", detail: "API key no configurada" }
  try {
    const res = await fetch("https://api.apollo.io/api/v1/usage_stats/credit_usage_stats", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "x-api-key": key },
    })
    if (res.status === 401) return { name: "apollo", label: "Apollo", status: "error", detail: "API key inválida" }
    if (res.status === 403) return { name: "apollo", label: "Apollo", status: "ok", detail: "Configurado (key sin scope de stats)" }
    if (!res.ok) return { name: "apollo", label: "Apollo", status: "error", detail: `HTTP ${res.status}` }
    const data = await res.json()
    const leadCredit = data?.credit_usage_stats?.lead_credit
    const remaining = leadCredit?.left_over ?? null
    const limit     = leadCredit?.limit ?? null
    const consumed  = leadCredit?.consumed ?? null
    if (remaining === null) return { name: "apollo", label: "Apollo", status: "ok", detail: "Configurado" }
    if (remaining <= 0) return { name: "apollo", label: "Apollo", status: "out", credits: 0, detail: `Sin créditos${limit ? ` (${consumed}/${limit} usados)` : ""}` }
    if (remaining < 100) return { name: "apollo", label: "Apollo", status: "low", credits: remaining, detail: `${remaining} créditos restantes` }
    return { name: "apollo", label: "Apollo", status: "ok", credits: remaining, detail: `${remaining} créditos disponibles` }
  } catch {
    return { name: "apollo", label: "Apollo", status: "error", detail: "Error al consultar" }
  }
}

async function checkFindymail(key: string | null): Promise<ProviderStatus> {
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

async function checkProspeo(key: string | null): Promise<ProviderStatus> {
  if (!key) return { name: "prospeo", label: "Prospeo", status: "unconfigured", detail: "API key no configurada" }
  try {
    const res = await fetch("https://api.prospeo.io/account-information", {
      headers: { "X-KEY": key },
    })
    if (!res.ok) return { name: "prospeo", label: "Prospeo", status: "error", detail: res.status === 400 ? "API key inválida" : `HTTP ${res.status}` }
    const data = await res.json()
    if (data?.error) return { name: "prospeo", label: "Prospeo", status: "error", detail: "API key inválida" }
    const remaining = data?.response?.remaining_credits ?? null
    const used      = data?.response?.used_credits ?? null
    if (remaining === null) return { name: "prospeo", label: "Prospeo", status: "ok", detail: "Configurado" }
    if (remaining <= 0) return { name: "prospeo", label: "Prospeo", status: "out", credits: 0, detail: `Sin créditos${used != null ? ` (${used} usados)` : ""}` }
    if (remaining < 20) return { name: "prospeo", label: "Prospeo", status: "low", credits: remaining, detail: `${remaining} créditos restantes` }
    return { name: "prospeo", label: "Prospeo", status: "ok", credits: remaining, detail: `${remaining} créditos disponibles` }
  } catch {
    return { name: "prospeo", label: "Prospeo", status: "error", detail: "Error al consultar" }
  }
}

async function checkDatagma(key: string | null): Promise<ProviderStatus> {
  if (!key) return { name: "datagma", label: "Datagma", status: "unconfigured", detail: "API key no configurada" }
  try {
    const res = await fetch(`https://gateway.datagma.net/api/ingress/v1/mine?apiId=${encodeURIComponent(key)}`)
    if (!res.ok) return { name: "datagma", label: "Datagma", status: "error", detail: `HTTP ${res.status}` }
    const data = await res.json()
    const remaining = data?.currentCredit != null ? parseInt(data.currentCredit, 10) : null
    if (remaining === null || isNaN(remaining)) return { name: "datagma", label: "Datagma", status: "ok", detail: "Configurado" }
    if (remaining <= 0) return { name: "datagma", label: "Datagma", status: "out", credits: 0, detail: "Sin créditos" }
    if (remaining < 20) return { name: "datagma", label: "Datagma", status: "low", credits: remaining, detail: `${remaining} créditos restantes` }
    return { name: "datagma", label: "Datagma", status: "ok", credits: remaining, detail: `${remaining.toLocaleString()} créditos disponibles` }
  } catch {
    return { name: "datagma", label: "Datagma", status: "error", detail: "Error al consultar" }
  }
}

export async function getProviderStatus(): Promise<ProviderStatus[]> {
  const keys = await getTenantApiKeys()
  const [apollo, zb, findymail, prospeo, datagma] = await Promise.all([
    checkApollo(keys.apollo_api_key ?? process.env.APOLLO_API_KEY ?? null),
    checkZeroBounce(keys.zerobounce_api_key ?? process.env.ZEROBOUNCE_API_KEY ?? null),
    checkFindymail(keys.findymail_api_key ?? process.env.FINDYMAIL_API_KEY ?? null),
    checkProspeo(keys.prospeo_api_key ?? process.env.PROSPEO_API_KEY ?? null),
    checkDatagma(keys.datagma_api_key ?? process.env.DATAGMA_API_KEY ?? null),
  ])
  return [apollo, findymail, prospeo, datagma, zb]
}
