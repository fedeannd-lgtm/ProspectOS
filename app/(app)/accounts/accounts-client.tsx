"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Building2, ExternalLink, Search, Download } from "lucide-react"

type Account = {
  id: string
  company_name: string
  domain: string | null
  sales_nav_id: string | null
  headcount_range: string | null
  status: string
  created_at: string
  campaign_id: string
  campaigns: { week_label: string; rep_name: string; industry: string } | null
}

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  discovered: { label: "Descubierta",  class: "bg-zinc-100 text-zinc-600" },
  approved:   { label: "Aprobada",     class: "bg-green-50 text-green-700" },
  rejected:   { label: "Rechazada",    class: "bg-red-50 text-red-700" },
  scraping:   { label: "Scrapeando",   class: "bg-blue-50 text-blue-700" },
  done:       { label: "Lista",        class: "bg-purple-50 text-purple-700" },
}

function domainUrl(domain: string | null) {
  if (!domain) return null
  return domain.startsWith("http") ? domain : `https://${domain}`
}

function cleanDomain(domain: string | null) {
  if (!domain) return null
  return domain.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
}

function exportCsv(rows: Account[]) {
  const headers = ["Empresa", "Dominio", "Industria", "SDR", "Semana", "Headcount", "Estado", "Fecha"]
  const escape = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`
  const lines = [
    headers.join(","),
    ...rows.map((a) => [
      escape(a.company_name),
      escape(cleanDomain(a.domain)),
      escape(a.campaigns?.industry),
      escape(a.campaigns?.rep_name),
      escape(a.campaigns?.week_label),
      escape(a.headcount_range),
      escape(a.status),
      new Date(a.created_at).toLocaleDateString("es"),
    ].join(",")),
  ]
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `empresas-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function AccountsClient({ accounts }: { accounts: Account[] }) {
  const [search, setSearch] = useState("")
  const [repFilter, setRepFilter] = useState("all")
  const [industryFilter, setIndustryFilter] = useState("all")
  const [campaignFilter, setCampaignFilter] = useState("all")

  const reps = useMemo(() => {
    const set = new Set(accounts.map((a) => a.campaigns?.rep_name).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [accounts])

  const industries = useMemo(() => {
    const set = new Set(accounts.map((a) => a.campaigns?.industry).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [accounts])

  const campaigns = useMemo(() => {
    const seen = new Map<string, string>()
    accounts.forEach((a) => {
      if (!a.campaign_id || !a.campaigns) return
      if (repFilter !== "all" && a.campaigns.rep_name !== repFilter) return
      if (industryFilter !== "all" && a.campaigns.industry !== industryFilter) return
      if (!seen.has(a.campaign_id)) {
        seen.set(a.campaign_id, `${a.campaigns.week_label} · ${a.campaigns.rep_name} · ${a.campaigns.industry}`)
      }
    })
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [accounts, repFilter, industryFilter])

  const campaignIds = useMemo(() => new Set(campaigns.map(([id]) => id)), [campaigns])

  const filtered = useMemo(() => {
    const resolvedCampaign = campaignIds.has(campaignFilter) ? campaignFilter : "all"
    const q = search.toLowerCase()
    return accounts.filter((a) => {
      if (repFilter !== "all" && a.campaigns?.rep_name !== repFilter) return false
      if (industryFilter !== "all" && a.campaigns?.industry !== industryFilter) return false
      if (resolvedCampaign !== "all" && a.campaign_id !== resolvedCampaign) return false
      if (q && !a.company_name?.toLowerCase().includes(q) &&
               !a.domain?.toLowerCase().includes(q)) return false
      return true
    })
  }, [accounts, search, repFilter, industryFilter, campaignFilter, campaignIds])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Empresas</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Todas las empresas prospectadas — {accounts.length} en total
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCsv(filtered)}
          disabled={filtered.length === 0}
        >
          <Download className="mr-2 size-4" />
          Exportar CSV ({filtered.length})
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por empresa o dominio…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={repFilter}
                onChange={(e) => { setRepFilter(e.target.value); setCampaignFilter("all") }}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">Todos los reps</option>
                {reps.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select
                value={industryFilter}
                onChange={(e) => { setIndustryFilter(e.target.value); setCampaignFilter("all") }}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">Todas las industrias</option>
                {industries.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
              <select
                value={campaignFilter}
                onChange={(e) => setCampaignFilter(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">Todas las campañas</option>
                {campaigns.map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <CardDescription className="mt-1">{filtered.length} resultados</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
              <Building2 className="mb-2 size-8 opacity-30" />
              Sin empresas todavía
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Empresa</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Dominio</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Industria</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">SDR</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Semana</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Headcount</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Estado</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => {
                    const statusCfg = STATUS_LABELS[a.status] ?? STATUS_LABELS.discovered
                    const url = domainUrl(a.domain)
                    const domain = cleanDomain(a.domain)
                    return (
                      <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 font-medium">
                          <div className="flex items-center gap-1.5">
                            {a.company_name || "—"}
                            {a.sales_nav_id && (
                              <a
                                href={`https://www.linkedin.com/sales/company/${a.sales_nav_id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="shrink-0 text-[#0A66C2] opacity-60 hover:opacity-100"
                                title="Ver en Sales Navigator"
                              >
                                <ExternalLink className="size-3" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {url && domain ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline font-mono text-xs"
                            >
                              {domain}
                              <ExternalLink className="size-3 opacity-60" />
                            </a>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{a.campaigns?.industry || "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{a.campaigns?.rep_name || "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{a.campaigns?.week_label || "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{a.headcount_range || "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.class}`}>
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">
                          {new Date(a.created_at).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
