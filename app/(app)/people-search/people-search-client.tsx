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
  RefreshCw,
  Timer,
  Building2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getPeopleSearchConfig,
  upsertPeopleSearchConfig,
  triggerPeopleSearch,
  getJobStatus,
} from "./actions"

type Campaign = {
  id: string
  week_label: string
  rep_name: string
  industry: string
  status: string
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

type PeopleSearchConfig = { base_url: string } | null

const MAX_OPTIONS = [25, 100, 250, 500]

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

function JobCard({ job }: { job: SearchJob }) {
  const cfg = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG] ?? JOB_STATUS_CONFIG.pending
  const Icon = cfg.icon
  const remaining = useCountdown(job.status === "running" ? job.estimated_ready_at : null)

  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
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
      <span className="ml-3 shrink-0 text-xs text-muted-foreground">
        {new Date(job.created_at).toLocaleDateString("es", { day: "numeric", month: "short" })}
      </span>
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
  const [campaignId, setCampaignId] = useState("")
  const [config, setConfig] = useState<PeopleSearchConfig>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [showUrlEdit, setShowUrlEdit] = useState(false)
  const [urlInput, setUrlInput] = useState("")
  const [maxResults, setMaxResults] = useState(100)
  const [isPending, startTransition] = useTransition()
  const [isSavingConfig, startSavingConfig] = useTransition()
  const [error, setError] = useState("")

  const selectedCampaign = campaigns.find((c) => c.id === campaignId)

  useEffect(() => {
    if (!selectedCampaign) {
      setConfig(null)
      setShowUrlEdit(false)
      return
    }

    setConfigLoading(true)
    setError("")
    getPeopleSearchConfig(selectedCampaign.rep_name, selectedCampaign.industry)
      .then((cfg) => {
        setConfig(cfg)
        if (cfg) {
          setUrlInput(cfg.base_url)
          setShowUrlEdit(false)
        } else {
          setUrlInput("")
          setShowUrlEdit(true)
        }
      })
      .catch(() => setError("Error cargando configuración"))
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

  function handleSaveConfig() {
    if (!selectedCampaign) return
    if (!urlInput.includes("linkedin.com")) { setError("URL de Sales Navigator inválida"); return }
    setError("")

    startSavingConfig(async () => {
      try {
        await upsertPeopleSearchConfig(selectedCampaign.rep_name, selectedCampaign.industry, urlInput)
        setConfig({ base_url: urlInput })
        setShowUrlEdit(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error guardando configuración")
      }
    })
  }

  function handleTrigger() {
    setError("")
    if (!campaignId || !selectedCampaign) { setError("Seleccioná una campaña"); return }
    if (!config) { setError("Configurá la URL de búsqueda primero"); return }

    startTransition(async () => {
      try {
        const { jobId, estimatedReadyAt } = await triggerPeopleSearch(
          campaignId,
          selectedCampaign.rep_name,
          selectedCampaign.industry,
          maxResults
        )
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
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al disparar la búsqueda")
      }
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
              <Select value={campaignId} onValueChange={(v) => setCampaignId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar campaña" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {`${c.week_label} · ${c.rep_name} · ${c.industry}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Link a empresas de la campaña */}
            {selectedCampaign && (
              <Link
                href={`/campaigns/${campaignId}`}
                className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors"
              >
                <Building2 className="size-4 text-muted-foreground shrink-0" />
                <span>Ver empresas y generar script para Sales Nav</span>
              </Link>
            )}

            {/* URL config */}
            {selectedCampaign && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                {configLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Cargando configuración…
                  </div>
                ) : config && !showUrlEdit ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="size-4 text-green-600" />
                        <span className="font-medium">URL configurada</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => { setShowUrlEdit(true); setUrlInput(config.base_url) }}
                      >
                        <RefreshCw className="mr-1 size-3" />
                        Actualizar URL
                      </Button>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Link2 className="size-3 shrink-0" />
                      <span className="truncate font-mono">{config.base_url.slice(0, 60)}…</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <AlertTriangle className="size-4" />
                      <span className="font-medium">
                        {config ? "Actualizar URL de búsqueda" : "Sin URL configurada"}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <Input
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://www.linkedin.com/sales/search/people#query=..."
                        className="font-mono text-xs"
                      />
                      <div className="flex items-center gap-2">
                        <Button size="sm" className="h-8" onClick={handleSaveConfig} disabled={isSavingConfig}>
                          {isSavingConfig ? <Loader2 className="size-3.5 animate-spin" /> : "Guardar"}
                        </Button>
                        {config && (
                          <Button variant="ghost" size="sm" className="h-8" onClick={() => setShowUrlEdit(false)}>
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </div>
                  </>
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
              </div>
              <p className="text-xs text-muted-foreground">
                Listo en ~{estimatedMin} min
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              className="w-full"
              onClick={handleTrigger}
              disabled={isPending || !config || !campaignId}
            >
              {isPending ? (
                <><Loader2 className="mr-2 size-4 animate-spin" /> Iniciando…</>
              ) : (
                <><Users className="mr-2 size-4" /> Buscar personas</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Jobs history */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de búsquedas</CardTitle>
            <CardDescription>Últimas 20 búsquedas</CardDescription>
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
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
