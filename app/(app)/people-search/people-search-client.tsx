"use client"

import { useState, useEffect, useTransition } from "react"
import Link from "next/link"
import {
  Users,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Link2,
  Timer,
  Building2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Check,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import {
  getPeopleSearchConfig,
  triggerPeopleSearch,
  getJobStatus,
  getProspectsForCampaign,
  deleteSearchJobs,
} from "./actions"
import { updateAccountListInUrl } from "@/lib/sales-nav-lists"

type Campaign = {
  id: string
  week_label: string
  rep_name: string
  industry: string
  status: string
  list_id: string | null
  list_name: string | null
}

type SearchJob = {
  id: string
  campaign_id: string
  status: string
  sales_nav_url: string | null
  results_count: number
  created_at: string
  completed_at: string | null
  estimated_ready_at?: string | null
  campaigns: { week_label: string; rep_name: string; industry: string } | null
}

type PeopleSearchConfig = {
  base_url: string
  base_url_2: string | null
  list_id: string | null
  list_name: string | null
  prev_list_id: string | null
  prev_list_name: string | null
  last_result_count: number | null
  last_count_checked_at: string | null
  last_result_count_2: number | null
  last_count_2_checked_at: string | null
} | null

const MAX_OPTIONS = [25, 100, 250, 500]

function addCountParams(salesNavUrl: string, repName: string, industry: string, urlIndex: 1 | 2) {
  const cb = encodeURIComponent(`${window.location.origin}/api/webhooks/extension/people-count`)
  const pos = `${encodeURIComponent(repName)}|${encodeURIComponent(industry)}`
  return `${salesNavUrl}&_pos=${pos}&_url=${urlIndex}&_cb=${cb}`
}

const JOB_STATUS_CONFIG = {
  pending:   { label: "Pendiente",  icon: Clock,        class: "bg-zinc-100 text-zinc-600" },
  running:   { label: "Scrapeando", icon: Loader2,      class: "bg-blue-50 text-blue-700" },
  completed: { label: "Listo",      icon: CheckCircle2, class: "bg-green-50 text-green-700" },
  failed:    { label: "Error",      icon: XCircle,      class: "bg-red-50 text-red-700" },
}

function useCountdown(targetIso: string | null | undefined) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!targetIso) { setRemaining(null); return }

    function tick() {
      const diff = Math.max(0, new Date(targetIso!).getTime() - Date.now())
      setRemaining(diff)
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetIso])

  return remaining
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "finalizando..."
  const totalSec = Math.ceil(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return min > 0 ? `~${min} min` : `${sec}s`
}

type Prospect = { id: string; first_name: string; last_name: string; full_name: string; job_title: string; company_name: string; linkedin_url: string; connection_degree: string; location: string }

function JobCard({ job, onDelete }: { job: SearchJob; onDelete: () => void }) {
  const cfg = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG] ?? JOB_STATUS_CONFIG.pending
  const Icon = cfg.icon
  const remaining = useCountdown(job.status === "running" ? job.estimated_ready_at : null)
  const [expanded, setExpanded] = useState(false)
  const [prospects, setProspects] = useState<Prospect[] | null>(null)
  const [loadingProspects, setLoadingProspects] = useState(false)

  async function toggleExpand() {
    if (!expanded && prospects === null) {
      setLoadingProspects(true)
      try {
        const data = await getProspectsForCampaign(job.campaign_id)
        setProspects(data)
      } catch {
        setProspects([])
      } finally {
        setLoadingProspects(false)
      }
    }
    setExpanded((v) => !v)
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.class}`}>
              <Icon className={`size-3 ${job.status === "running" ? "animate-spin" : ""}`} />
              {cfg.label}
            </span>
            {job.status === "running" && remaining !== null && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Timer className="size-3" />
                {formatCountdown(remaining)}
              </span>
            )}
            {job.status === "completed" && (
              <span className="text-xs text-muted-foreground">{job.results_count} personas</span>
            )}
          </div>
          {job.campaigns && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {job.campaigns.week_label} · {job.campaigns.rep_name} · {job.campaigns.industry}
            </p>
          )}
        </div>
        <div className="ml-3 flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">
            {new Date(job.created_at).toLocaleDateString("es", { day: "numeric", month: "short" })}
          </span>
          {job.status === "completed" && (
            <button
              onClick={toggleExpand}
              className="rounded p-1 hover:bg-muted/50 text-muted-foreground transition-colors"
            >
              {loadingProspects
                ? <Loader2 className="size-3.5 animate-spin" />
                : expanded
                  ? <ChevronUp className="size-3.5" />
                  : <ChevronDown className="size-3.5" />}
            </button>
          )}
          <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-destructive" onClick={onDelete}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {expanded && prospects !== null && (
        <div className="border-t bg-muted/30 max-h-72 overflow-y-auto">
          {prospects.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground text-center">Sin personas guardadas para esta campaña</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Nombre</th>
                  <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Apellido</th>
                  <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Nombre completo</th>
                  <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Cargo</th>
                  <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Empresa</th>
                  <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Ubicación</th>
                  <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Grado</th>
                </tr>
              </thead>
              <tbody>
                {prospects.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-3 py-1.5">{p.first_name || "—"}</td>
                    <td className="px-3 py-1.5">{p.last_name || "—"}</td>
                    <td className="px-3 py-1.5">
                      {p.linkedin_url ? (
                        <a href={p.linkedin_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                          {p.full_name || "—"}
                        </a>
                      ) : (p.full_name || "—")}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{p.job_title || "—"}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{p.company_name || "—"}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{p.location || "—"}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{p.connection_degree || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

export function PeopleSearchClient({
  campaigns,
  initialJobs,
}: {
  campaigns: Campaign[]
  initialJobs: SearchJob[]
}) {
  const [jobs, setJobs] = useState<SearchJob[]>(initialJobs)
  const [campaignId, setCampaignId] = useState(() => {
    if (typeof window === "undefined") return ""
    return localStorage.getItem("ps_last_campaign") ?? ""
  })
  const [comboOpen, setComboOpen] = useState(false)
  const [config, setConfig] = useState<PeopleSearchConfig>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [maxResults, setMaxResults] = useState(100)
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDeleting] = useTransition()
  const [error, setError] = useState("")
  const [pickedListId, setPickedListId] = useState("")
  const [pickedListName, setPickedListName] = useState("")
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [generatedUrlList, setGeneratedUrlList] = useState<string | null>(null)
  const [selectedUrlIndex, setSelectedUrlIndex] = useState<1 | 2>(1)
  const [generatedUrl2, setGeneratedUrl2] = useState<string | null>(null)
  const [generatedUrl2List, setGeneratedUrl2List] = useState<string | null>(null)
  const selectedCampaign = campaigns.find((c) => c.id === campaignId)

  const availableLists = selectedCampaign
    ? campaigns.filter(
        (c): c is Campaign & { list_id: string; list_name: string } =>
          c.rep_name === selectedCampaign.rep_name &&
          c.industry === selectedCampaign.industry &&
          c.list_id !== null &&
          c.list_name !== null
      )
    : []

  useEffect(() => {
    if (!selectedCampaign) {
      setConfig(null)
      setGeneratedUrl(null)
      return
    }
    setPickedListId(selectedCampaign.list_id ?? "")
    setPickedListName(selectedCampaign.list_name ?? "")
    setGeneratedUrl(null)
    setGeneratedUrlList(null)
    setConfigLoading(true)
    setError("")
    setGeneratedUrl2(null)
    setGeneratedUrl2List(null)
    getPeopleSearchConfig(selectedCampaign.rep_name, selectedCampaign.industry)
      .then((cfg) => {
        setConfig(cfg)
        if (cfg) {
          const listId = selectedCampaign!.list_id
          const listName = selectedCampaign!.list_name
          if (listId && listName) {
            setGeneratedUrl(updateAccountListInUrl(cfg.base_url, listId, listName, cfg.prev_list_id))
            setGeneratedUrlList(listName)
            if (cfg.base_url_2) {
              setGeneratedUrl2(updateAccountListInUrl(cfg.base_url_2, listId, listName, cfg.prev_list_id))
              setGeneratedUrl2List(listName)
            }
          }
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error cargando configuración"))
      .finally(() => setConfigLoading(false))
  }, [selectedCampaign?.id, selectedCampaign?.rep_name, selectedCampaign?.industry])

  // Poll running jobs every 10s
  useEffect(() => {
    const running = jobs.filter((j) => j.status === "running" || j.status === "pending")
    if (running.length === 0) return

    const interval = setInterval(async () => {
      for (const job of running) {
        const result = await getJobStatus(job.id)
        if (result) {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === job.id
                ? { ...j, status: result.status, results_count: result.results_count }
                : j
            )
          )
        }
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [jobs])

  const activeGeneratedUrl = selectedUrlIndex === 1 ? generatedUrl : generatedUrl2

  function handleDeleteJob(id: string) {
    setJobs((prev) => prev.filter((j) => j.id !== id))
    startDeleting(() => deleteSearchJobs([id]))
  }

  function handleClearAll() {
    const ids = jobs.map((j) => j.id)
    setJobs([])
    startDeleting(() => deleteSearchJobs(ids))
  }

  function handleTrigger() {
    setError("")
    if (!campaignId || !selectedCampaign) { setError("Seleccioná una campaña"); return }
    if (!config) { setError("Configurá la URL de búsqueda primero"); return }
    if (!activeGeneratedUrl) { setError("Generá la URL primero — asegurate de usar la lista de esta campaña"); return }

    startTransition(async () => {
      const result = await triggerPeopleSearch(
        campaignId,
        selectedCampaign.rep_name,
        selectedCampaign.industry,
        maxResults,
        activeGeneratedUrl
      )
      if ("error" in result) {
        setError(result.error)
        return
      }
      const { jobId, estimatedReadyAt } = result
      const newJob: SearchJob = {
        id: jobId,
        campaign_id: campaignId,
        status: "running",
        sales_nav_url: config.base_url,
        results_count: 0,
        created_at: new Date().toISOString(),
        completed_at: null,
        estimated_ready_at: estimatedReadyAt,
        campaigns: {
          week_label: selectedCampaign.week_label,
          rep_name: selectedCampaign.rep_name,
          industry: selectedCampaign.industry,
        },
      }
      setJobs((prev) => [newJob, ...prev])
    })
  }

  const estimatedMin = Math.ceil((maxResults / 500) * 20)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">People Search</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Scrapeás personas de las empresas encontradas. Primero creá la lista de cuentas en Sales Navigator con las empresas de abajo.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nueva búsqueda</CardTitle>
            <CardDescription>
              Seleccioná la campaña, configurá la URL y elegí cuántas personas scrapear.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Campaña</label>
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger
                  className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs ring-offset-background hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {selectedCampaign
                    ? <span>{selectedCampaign.week_label} — <span className="text-muted-foreground">{selectedCampaign.rep_name} / {selectedCampaign.industry}</span></span>
                    : <span className="text-muted-foreground">Seleccionar campaña…</span>}
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-[var(--available-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar por rep, industria, semana…" />
                    <CommandList>
                      <CommandEmpty>Sin resultados.</CommandEmpty>
                      {Object.entries(
                        campaigns.reduce((groups, c) => {
                          if (!groups[c.rep_name]) groups[c.rep_name] = []
                          groups[c.rep_name].push(c)
                          return groups
                        }, {} as Record<string, typeof campaigns>)
                      ).map(([rep, items]) => (
                        <CommandGroup key={rep} heading={rep}>
                          {items.map((c) => (
                            <CommandItem key={c.id} value={`${c.week_label} ${c.rep_name} ${c.industry}`}
                              onSelect={() => { setCampaignId(c.id); localStorage.setItem("ps_last_campaign", c.id); setComboOpen(false) }}>
                              <Check className={`mr-2 size-4 ${campaignId === c.id ? "opacity-100" : "opacity-0"}`} />
                              <span>{c.week_label}</span>
                              <span className="ml-2 text-muted-foreground text-xs">{c.industry}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Link a empresas de la campaña */}
            {selectedCampaign && (
              <Link
                href={`/campaigns/${campaignId}`}
                className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors"
              >
                <Building2 className="size-4 text-muted-foreground shrink-0" />
                <span>Ver empresas de la campaña</span>
              </Link>
            )}

            {/* Generar URL de People Search */}
            {selectedCampaign && (
              <div className="space-y-2">
                <div className="rounded-lg border p-3 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">Lista de cuentas</p>

                  {availableLists.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Sin lista creada para esta campaña.{" "}
                      <Link href={`/campaigns/${campaignId}`} className="underline underline-offset-2">
                        Ir a la campaña
                      </Link>
                      {" "}→ seleccioná empresas → "Crear Account List" con la extensión de Chrome.
                    </p>
                  ) : (
                    <>
                      <Select
                        value={pickedListId}
                        onValueChange={(v: string | null) => {
                          if (!v) return
                          const list = availableLists.find((l) => l.list_id === v)
                          const name = list?.list_name || ""
                          setPickedListId(v)
                          setPickedListName(name)
                          if (config) {
                            setGeneratedUrl(updateAccountListInUrl(config.base_url, v, name, config.prev_list_id))
                            setGeneratedUrlList(name)
                            if (config.base_url_2) {
                              setGeneratedUrl2(updateAccountListInUrl(config.base_url_2, v, name, config.prev_list_id))
                              setGeneratedUrl2List(name)
                            } else {
                              setGeneratedUrl2(null)
                              setGeneratedUrl2List(null)
                            }
                          } else {
                            setGeneratedUrl(null)
                            setGeneratedUrlList(null)
                            setGeneratedUrl2(null)
                            setGeneratedUrl2List(null)
                          }
                        }}
                      >
                        <SelectTrigger>
                          {pickedListName
                            ? <span>{pickedListName}</span>
                            : <span className="text-muted-foreground">Seleccionar lista…</span>}
                        </SelectTrigger>
                        <SelectContent>
                          {availableLists.map((l) => (
                            <SelectItem key={l.list_id!} value={l.list_id!}>
                              {l.list_name} · {l.week_label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                    </>
                  )}
                </div>

                {/* URL panels */}
                {configLoading ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> Cargando configuración…
                  </div>
                ) : !config ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-center gap-2 text-sm text-amber-700">
                      <AlertTriangle className="size-4 shrink-0" />
                      <span>Sin URL de People Search para {selectedCampaign.rep_name}/{selectedCampaign.industry} —{" "}
                        <Link href="/settings" className="underline underline-offset-2">configurala en Settings</Link>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className={`grid gap-3 ${config.base_url_2 ? "grid-cols-2" : "grid-cols-1"}`}>
                    {/* URL 1 panel */}
                    <div
                      className={`rounded-lg border-2 p-3 space-y-2.5 transition-colors ${
                        config.base_url_2
                          ? selectedUrlIndex === 1
                            ? "border-foreground bg-muted/20"
                            : "border-border cursor-pointer hover:border-muted-foreground/40"
                          : "border-border"
                      }`}
                      onClick={() => config.base_url_2 && setSelectedUrlIndex(1)}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">URL 1</p>
                        {config.base_url_2 && (
                          <span className={`size-3 rounded-full border-2 transition-colors ${selectedUrlIndex === 1 ? "bg-foreground border-foreground" : "border-muted-foreground/30"}`} />
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                        <Link2 className="size-3 shrink-0 opacity-60" />
                        <span className="truncate font-mono text-[11px]">{config.base_url.slice(0, 34)}…</span>
                        <Link href="/settings" className="ml-auto shrink-0 text-[11px] text-muted-foreground hover:text-foreground">
                          Cambiar en Settings ↗
                        </Link>
                      </div>

                      {generatedUrl && (
                        <div className="rounded-md border border-green-200 bg-green-50 px-2.5 py-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] font-semibold text-green-700">✓ Lista aplicada</p>
                            {config.last_result_count !== null && (
                              <span className="text-[10px] font-semibold text-green-700">
                                {config.last_result_count.toLocaleString()} resultados
                              </span>
                            )}
                          </div>
                          {generatedUrlList && <p className="text-xs font-medium text-green-800 truncate">{generatedUrlList}</p>}
                          <a href={selectedCampaign ? addCountParams(generatedUrl, selectedCampaign.rep_name, selectedCampaign.industry, 1) : generatedUrl}
                            target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800">
                            <ExternalLink className="size-3" /> Abrir en Sales Navigator
                          </a>
                        </div>
                      )}
                    </div>

                    {/* URL 2 panel */}
                    <div
                      className={`rounded-lg border-2 p-3 space-y-2.5 transition-colors ${
                        config.base_url_2
                          ? selectedUrlIndex === 2
                            ? "border-foreground bg-muted/20"
                            : "border-border cursor-pointer hover:border-muted-foreground/40"
                          : "border-dashed border-muted-foreground/20"
                      }`}
                      onClick={() => config.base_url_2 && setSelectedUrlIndex(2)}
                    >
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-semibold ${config.base_url_2 ? "" : "text-muted-foreground"}`}>URL 2</p>
                        {config.base_url_2 && (
                          <span className={`size-3 rounded-full border-2 transition-colors ${selectedUrlIndex === 2 ? "bg-foreground border-foreground" : "border-muted-foreground/30"}`} />
                        )}
                      </div>

                      {!config.base_url_2 ? (
                        <Link href="/settings" className="text-xs text-muted-foreground hover:text-foreground">
                          + Agregar en Settings ↗
                        </Link>
                      ) : (
                        <>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                            <Link2 className="size-3 shrink-0 opacity-60" />
                            <span className="truncate font-mono text-[11px]">{config.base_url_2!.slice(0, 34)}…</span>
                            <Link href="/settings" className="ml-auto shrink-0 text-[11px] text-muted-foreground hover:text-foreground">
                              Cambiar en Settings ↗
                            </Link>
                          </div>

                          {generatedUrl2 && (
                            <div className="rounded-md border border-green-200 bg-green-50 px-2.5 py-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[10px] font-semibold text-green-700">✓ Lista aplicada</p>
                                {config.last_result_count_2 !== null && (
                                  <span className="text-[10px] font-semibold text-green-700">
                                    {config.last_result_count_2.toLocaleString()} resultados
                                  </span>
                                )}
                              </div>
                              {generatedUrl2List && <p className="text-xs font-medium text-green-800 truncate">{generatedUrl2List}</p>}
                              <a href={selectedCampaign ? addCountParams(generatedUrl2, selectedCampaign.rep_name, selectedCampaign.industry, 2) : generatedUrl2}
                                target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800">
                                <ExternalLink className="size-3" /> Abrir en Sales Navigator
                              </a>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Personas a scrapear</label>
              <div className="flex gap-2">
                {MAX_OPTIONS.map((n) => (
                  <Button
                    key={n}
                    variant={maxResults === n ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setMaxResults(n)}
                  >
                    {n}
                  </Button>
                ))}
                <Input
                  type="number"
                  min={1}
                  max={2500}
                  placeholder="otro"
                  className="w-20 text-sm text-center"
                  value={MAX_OPTIONS.includes(maxResults) ? "" : maxResults}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10)
                    if (!isNaN(v) && v > 0) setMaxResults(v)
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Listo en ~{estimatedMin} min
              </p>
            </div>

{error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              className="w-full"
              onClick={handleTrigger}
              disabled={isPending || !config || !campaignId || !activeGeneratedUrl}
            >
              {isPending ? (
                <><Loader2 className="mr-2 size-4 animate-spin" /> Iniciando…</>
              ) : (
                <><Users className="mr-2 size-4" /> Buscar personas{config?.base_url_2 ? ` URL ${selectedUrlIndex}` : ""}</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Jobs history */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Historial de búsquedas</CardTitle>
                <CardDescription>Últimas 20 búsquedas</CardDescription>
              </div>
              {jobs.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={handleClearAll} disabled={isDeleting}>
                  <Trash2 className="mr-1.5 size-3.5" />
                  Limpiar todo
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground">
                <Users className="mb-2 size-8 opacity-30" />
                Sin búsquedas todavía
              </div>
            ) : (
              <div className="space-y-2">
                {jobs.map((job) => (
                  <JobCard key={job.id} job={job} onDelete={() => handleDeleteJob(job.id)} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
