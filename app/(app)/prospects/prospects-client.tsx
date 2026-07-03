"use client"

import { useState, useEffect, useTransition, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Users, ExternalLink, Search, Download, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { getFilteredProspects, getCampaignsForFilter, getAllFilteredProspects, deleteProspects, type ProspectRow } from "./actions"

const REPS = ["Alu", "Fede", "Guido", "Jess", "Suva"]
const INDUSTRIES = [
  "Retail & Comercio", "Manufactura", "Finance & Insurance", "Agro & Energy",
  "Construcción", "BPO & Professional Services", "Health & Entertainment", "Consulting & Telco",
]

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  scraped:   { label: "Scrapeado",   class: "bg-zinc-100 text-zinc-600" },
  enriched:  { label: "Enriquecido", class: "bg-blue-50 text-blue-700" },
  approved:  { label: "Aprobado",    class: "bg-green-50 text-green-700" },
  rejected:  { label: "Rechazado",   class: "bg-red-50 text-red-700" },
  sent:      { label: "Enviado",     class: "bg-purple-50 text-purple-700" },
}

function campaignLabel(p: ProspectRow) {
  if (!p.campaigns) return ""
  return `${p.campaigns.week_label} · ${p.campaigns.rep_name} · ${p.campaigns.industry}`
}

function exportCsv(rows: ProspectRow[]) {
  const headers = ["Nombre", "Apellido", "Nombre completo", "Cargo", "Empresa", "Dominio", "Ubicación", "Email", "LinkedIn", "Grado", "Antigüedad (mes)", "Premium", "Highlights", "ICP", "Estado", "Campaña"]
  const escape = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`
  const lines = [
    headers.join(","),
    ...rows.map((p) => [
      escape(p.first_name), escape(p.last_name), escape(p.full_name),
      escape(p.job_title), escape(p.company_name), escape(p.company_domain),
      escape(p.location), escape(p.email), escape(p.linkedin_url),
      escape(p.connection_degree), p.started_role_months ?? "",
      p.is_premium ? "TRUE" : "FALSE", escape(p.highlights),
      p.icp_score > 0 ? p.icp_score : "", escape(p.status), escape(campaignLabel(p)),
    ].join(",")),
  ]
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a"); a.href = url
  a.download = `prospectos-${new Date().toISOString().slice(0, 10)}.csv`
  a.click(); URL.revokeObjectURL(url)
}

export function ProspectsClient() {
  const [repFilter, setRepFilter] = useState("all")
  const [industryFilter, setIndustryFilter] = useState("all")
  const [campaignFilter, setCampaignFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const [prospects, setProspects] = useState<ProspectRow[]>([])
  const [total, setTotal] = useState(0)
  const [campaigns, setCampaigns] = useState<{ id: string; week_label: string; rep_name: string; industry: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  const hasFilter = repFilter !== "all" || industryFilter !== "all" || campaignFilter !== "all"

  // Load campaigns list when rep/industry changes
  useEffect(() => {
    getCampaignsForFilter(repFilter, industryFilter).then(setCampaigns).catch(() => setCampaigns([]))
    setCampaignFilter("all")
    setPage(1)
  }, [repFilter, industryFilter])

  // Load prospects when any filter or page changes, but only if a filter is active
  useEffect(() => {
    if (!hasFilter) { setProspects([]); setTotal(0); return }
    setLoading(true)
    setSelected(new Set())
    getFilteredProspects(repFilter, industryFilter, campaignFilter, page)
      .then(({ data, total }) => { setProspects(data); setTotal(total) })
      .catch(() => { setProspects([]); setTotal(0) })
      .finally(() => setLoading(false))
  }, [repFilter, industryFilter, campaignFilter, page, hasFilter])

  const totalPages = Math.max(1, Math.ceil(total / 100))

  // Client-side search within the current page
  const displayed = useMemo(() => {
    if (!search) return prospects
    const q = search.toLowerCase()
    return prospects.filter((p) =>
      p.full_name?.toLowerCase().includes(q) ||
      p.job_title?.toLowerCase().includes(q) ||
      p.company_name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q)
    )
  }, [prospects, search])

  const allSelected = displayed.length > 0 && displayed.every((p) => selected.has(p.id))

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => { const next = new Set(prev); displayed.forEach((p) => next.delete(p.id)); return next })
    } else {
      setSelected((prev) => { const next = new Set(prev); displayed.forEach((p) => next.add(p.id)); return next })
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  function handleDelete(ids: string[]) {
    if (!ids.length) return
    setProspects((prev) => prev.filter((p) => !ids.includes(p.id)))
    setSelected((prev) => { const next = new Set(prev); ids.forEach((id) => next.delete(id)); return next })
    startTransition(() => deleteProspects(ids))
  }

  const selectedInView = displayed.filter((p) => selected.has(p.id))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Prospectos</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {hasFilter ? `${total} en total` : "Seleccioná un rep o campaña para ver sus prospectos"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedInView.length > 0 && (
            <Button variant="destructive" size="sm"
              onClick={() => handleDelete(selectedInView.map((p) => p.id))} disabled={isPending}>
              <Trash2 className="mr-2 size-4" />
              Eliminar {selectedInView.length} seleccionados
            </Button>
          )}
          {hasFilter && (
            <Button variant="outline" size="sm" disabled={total === 0 || exporting}
              onClick={async () => {
                setExporting(true)
                try {
                  const all = await getAllFilteredProspects(repFilter, industryFilter, campaignFilter)
                  exportCsv(all)
                } finally {
                  setExporting(false)
                }
              }}>
              <Download className="mr-2 size-4" />
              {exporting ? "Bajando…" : `Exportar CSV (${total})`}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input placeholder="Buscar en esta página…" value={search}
                onChange={(e) => setSearch(e.target.value)} className="pl-8" />
            </div>
            <div className="flex flex-wrap gap-2">
              <select value={repFilter}
                onChange={(e) => { setRepFilter(e.target.value); setPage(1) }}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="all">Todos los reps</option>
                {REPS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={industryFilter}
                onChange={(e) => { setIndustryFilter(e.target.value); setPage(1) }}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="all">Todas las industrias</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
              <select value={campaignFilter}
                onChange={(e) => { setCampaignFilter(e.target.value); setPage(1) }}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="all">Todas las campañas</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.week_label} · {c.rep_name} · {c.industry}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {hasFilter && (
            <CardDescription className="mt-1">
              {loading ? "Cargando…" : `${displayed.length} en esta página · pág. ${page} de ${totalPages}`}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {!hasFilter ? (
            <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
              <Users className="mb-2 size-8 opacity-30" />
              Seleccioná un rep, industria o campaña
            </div>
          ) : loading ? (
            <div className="flex justify-center py-16 text-sm text-muted-foreground">Cargando…</div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
              <Users className="mb-2 size-8 opacity-30" />
              Sin resultados
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2.5 w-8">
                        <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
                      </th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Nombre</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Apellido</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Nombre completo</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Cargo</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Empresa</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Dominio</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Ubicación</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Email</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Grado</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Mes inicio</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Highlights</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">ICP</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Estado</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Campaña</th>
                      <th className="px-3 py-2.5 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((p) => {
                      const statusCfg = STATUS_LABELS[p.status] ?? STATUS_LABELS.scraped
                      return (
                        <tr key={p.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${selected.has(p.id) ? "bg-blue-50/50" : ""}`}>
                          <td className="px-3 py-2.5">
                            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} className="rounded" />
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{p.first_name || "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{p.last_name || "—"}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {p.linkedin_url ? (
                                <a href={p.linkedin_url} target="_blank" rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium">
                                  {p.full_name || "—"}<ExternalLink className="size-3 opacity-60" />
                                </a>
                              ) : (
                                <span className="font-medium">{p.full_name || "—"}</span>
                              )}
                              {p.is_premium && (
                                <span className="rounded px-1 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 leading-none">PRO</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{p.job_title || "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{p.company_name || "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{p.company_domain || "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{p.location || "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{p.email || "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{p.connection_degree || "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{p.started_role_months ?? "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground max-w-[200px] truncate" title={p.highlights ?? ""}>{p.highlights || "—"}</td>
                          <td className="px-4 py-2.5">
                            {p.icp_score > 0 ? (
                              <span className={`font-medium ${p.icp_score >= 10 ? "text-green-700" : p.icp_score >= 5 ? "text-amber-600" : "text-muted-foreground"}`}>
                                {p.icp_score}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.class}`}>
                              {statusCfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{campaignLabel(p) || "—"}</td>
                          <td className="px-3 py-2.5">
                            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete([p.id])} disabled={isPending}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    Pág. {page} de {totalPages} · {total} prospectos
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="size-7"
                      onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="size-7"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
