"use client"

import { useState, useTransition, useEffect } from "react"
import { Plus, Play, Copy, Trash2, ChevronUp, ChevronDown, X, Loader2, CheckCircle2, AlertCircle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import type { DistributionTemplate, DistributionRoute, Condition, ConditionGroup, DistributionRun, RunResults } from "./actions"
import type { IntegrationCampaign } from "./actions"
import { saveTemplate, cloneTemplate, deleteTemplate, runDistribution, getRunsForTemplate, previewDistribution, getTemplates, loadIntegrationCampaigns } from "./actions"

// ─── Constants ────────────────────────────────────────────────────────────────

const CONDITION_FIELDS = [
  { value: "has_email", label: "Tiene email" },
  { value: "email_status", label: "Estado email" },
  { value: "icp_score", label: "ICP Score" },
  { value: "os_score", label: "OS Score" },
  { value: "icp_category", label: "Categoría ICP" },
  { value: "is_premium", label: "Premium LinkedIn" },
  { value: "connection_degree", label: "Grado conexión" },
]

const OPERATORS_FOR_FIELD: Record<string, { value: string; label: string }[]> = {
  has_email: [{ value: "eq", label: "=" }],
  email_status: [{ value: "eq", label: "=" }, { value: "neq", label: "≠" }],
  icp_score: [{ value: "gte", label: ">=" }, { value: "lte", label: "<=" }, { value: "eq", label: "=" }],
  os_score: [{ value: "gte", label: ">=" }, { value: "lte", label: "<=" }, { value: "eq", label: "=" }],
  icp_category: [{ value: "eq", label: "=" }],
  is_premium: [{ value: "eq", label: "=" }],
  connection_degree: [{ value: "eq", label: "=" }],
}

const VALUES_FOR_FIELD: Record<string, { value: string; label: string }[] | null> = {
  has_email: [{ value: "true", label: "Sí" }, { value: "false", label: "No" }],
  email_status: [
    { value: "valid", label: "Válido" },
    { value: "catch-all", label: "Catch-all" },
    { value: "invalid", label: "Inválido" },
    { value: "unknown", label: "Desconocido" },
  ],
  icp_score: null,
  os_score: null,
  icp_category: [
    { value: "Experience", label: "Experience" },
    { value: "Helpdesk", label: "Helpdesk" },
    { value: "Onboarding", label: "Onboarding" },
    { value: "Communication", label: "Communication" },
    { value: "Genérico", label: "Genérico" },
  ],
  is_premium: [{ value: "true", label: "Sí" }, { value: "false", label: "No" }],
  connection_degree: [
    { value: "FIRST", label: "1er grado" },
    { value: "SECOND", label: "2do grado" },
    { value: "THIRD", label: "3er grado" },
  ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newCondition(): Condition {
  return { field: "has_email", operator: "eq", value: "true" }
}

function newRoute(priority: number): DistributionRoute {
  return { id: crypto.randomUUID(), name: null, priority, conditions: [[newCondition()]], smartlead_campaign_id: null, heyreach_campaign_id: null }
}

// ─── ConditionRow ─────────────────────────────────────────────────────────────

function ConditionRow({ cond, onChange, onRemove }: {
  cond: Condition
  onChange: (c: Condition) => void
  onRemove: () => void
}) {
  const operators = OPERATORS_FOR_FIELD[cond.field] ?? [{ value: "eq", label: "=" }]
  const valueOptions = VALUES_FOR_FIELD[cond.field]

  function handleFieldChange(field: string | null) {
    if (!field) return
    const ops = OPERATORS_FOR_FIELD[field] ?? [{ value: "eq", label: "=" }]
    const vals = VALUES_FOR_FIELD[field]
    onChange({ field, operator: ops[0].value, value: vals ? vals[0].value : "" })
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={cond.field} onValueChange={handleFieldChange}>
        <SelectTrigger className="h-7 text-xs w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CONDITION_FIELDS.map((f) => (
            <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={cond.operator} onValueChange={(v) => v && onChange({ ...cond, operator: v })}>
        <SelectTrigger className="h-7 text-xs w-16">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operators.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {valueOptions ? (
        <Select value={cond.value} onValueChange={(v) => v && onChange({ ...cond, value: v })}>
          <SelectTrigger className="h-7 text-xs w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {valueOptions.map((v) => (
              <SelectItem key={v.value} value={v.value} className="text-xs">{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          className="h-7 text-xs w-20"
          type="number"
          value={cond.value}
          onChange={(e) => onChange({ ...cond, value: e.target.value })}
          placeholder="valor"
        />
      )}

      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
        <X className="size-3.5" />
      </button>
    </div>
  )
}

// ─── DestinationsSection ──────────────────────────────────────────────────────

function DestinationSelect({ label, options, value, onChange }: {
  label: string
  options: IntegrationCampaign[] | null
  value: string | null
  onChange: (v: string | null) => void
}) {
  const resolvedName = options?.find((c) => c.id === value)?.name

  if (!options) {
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs w-20 text-muted-foreground shrink-0">{label}</span>
          <Input
            className="h-7 text-xs font-mono"
            placeholder="Campaign ID"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
          />
        </div>
        {value && <p className="ml-[88px] text-[11px] text-muted-foreground">Cargá las campañas para ver el nombre</p>}
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <span className="text-xs w-20 text-muted-foreground shrink-0">{label}</span>
        <Select value={value ?? "__none__"} onValueChange={(v) => onChange(v === "__none__" ? null : v)}>
          <SelectTrigger className="h-7 text-xs flex-1">
            <SelectValue placeholder="Seleccioná una campaña..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__" className="text-xs text-muted-foreground">Sin campaña</SelectItem>
            {options.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {value && resolvedName && (
        <p className="ml-[88px] text-[11px] text-muted-foreground font-mono">ID: {value}</p>
      )}
      {value && !resolvedName && (
        <p className="ml-[88px] text-[11px] text-amber-500">ID {value} no aparece en la lista</p>
      )}
    </div>
  )
}

function DestinationsSection({ route, onChange, integrationCampaigns }: {
  route: DistributionRoute
  onChange: (r: DistributionRoute) => void
  integrationCampaigns: { smartlead: IntegrationCampaign[]; heyreach: IntegrationCampaign[] } | null
}) {
  return (
    <div className="space-y-2 pt-1 border-t">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Destinos</p>
      <DestinationSelect
        label="Smartlead"
        options={integrationCampaigns?.smartlead ?? null}
        value={route.smartlead_campaign_id}
        onChange={(v) => onChange({ ...route, smartlead_campaign_id: v })}
      />
      <DestinationSelect
        label="HeyReach"
        options={integrationCampaigns?.heyreach ?? null}
        value={route.heyreach_campaign_id}
        onChange={(v) => onChange({ ...route, heyreach_campaign_id: v })}
      />
    </div>
  )
}

// ─── RouteCard ────────────────────────────────────────────────────────────────

function RouteCard({ route, index, total, onChange, onMoveUp, onMoveDown, onClone, onRemove, integrationCampaigns }: {
  route: DistributionRoute
  index: number
  total: number
  onChange: (r: DistributionRoute) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onClone: () => void
  onRemove: () => void
  integrationCampaigns: { smartlead: IntegrationCampaign[]; heyreach: IntegrationCampaign[] } | null
}) {
  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">RUTA {index + 1}</span>
          <Input
            className="h-6 text-xs w-48 border-0 bg-transparent px-1 focus-visible:ring-0"
            placeholder="Nombre de la ruta (opcional)"
            value={route.name ?? ""}
            onChange={(e) => onChange({ ...route, name: e.target.value || null })}
          />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onMoveUp} disabled={index === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ChevronUp className="size-4" />
          </button>
          <button onClick={onMoveDown} disabled={index === total - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ChevronDown className="size-4" />
          </button>
          <button onClick={onClone} className="text-muted-foreground hover:text-primary ml-1" title="Clonar ruta">
            <Copy className="size-3.5" />
          </button>
          <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Conditions — AND within group, OR between groups */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Condiciones</p>

        {route.conditions.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && (
              <div className="flex items-center gap-2 py-0.5">
                <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                <span className="text-[10px] font-bold text-muted-foreground px-1">O</span>
                <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
              </div>
            )}
            <div className="space-y-1.5 pl-2 border-l-2 border-muted">
              {group.map((cond, ci) => (
                <ConditionRow
                  key={ci}
                  cond={cond}
                  onChange={(c) => {
                    const conditions: ConditionGroup[] = route.conditions.map((g, i) =>
                      i === gi ? g.map((x, j) => (j === ci ? c : x)) : g
                    )
                    onChange({ ...route, conditions })
                  }}
                  onRemove={() => {
                    const conditions: ConditionGroup[] = route.conditions
                      .map((g, i) => (i === gi ? g.filter((_, j) => j !== ci) : g))
                      .filter((g) => g.length > 0)
                    onChange({ ...route, conditions })
                  }}
                />
              ))}
              <button
                onClick={() => {
                  const conditions: ConditionGroup[] = route.conditions.map((g, i) =>
                    i === gi ? [...g, newCondition()] : g
                  )
                  onChange({ ...route, conditions })
                }}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="size-3" /> Agregar condición
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={() => onChange({ ...route, conditions: [...route.conditions, [newCondition()]] })}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1"
        >
          <Plus className="size-3" /> Agregar grupo OR
        </button>
      </div>

      {/* Destinations */}
      <DestinationsSection route={route} onChange={onChange} integrationCampaigns={integrationCampaigns} />
    </div>
  )
}

// ─── Run modal ────────────────────────────────────────────────────────────────

function RunModal({ template, campaigns, onClose, onRun }: {
  template: DistributionTemplate
  campaigns: { id: string; week_label: string; rep_name: string; industry: string; prospects_found: number | null }[]
  onClose: () => void
  onRun: (campaignId: string, includePrev: boolean) => void
}) {
  const [campaignId, setCampaignId] = useState("")
  const [includePrev, setIncludePrev] = useState(false)
  const [preview, setPreview] = useState<{ total: number; previouslySent: number } | null>(null)
  const [loadingPreview, startPreview] = useTransition()

  function handleCampaignChange(id: string | null) {
    if (!id) return
    setCampaignId(id)
    startPreview(async () => {
      const p = await previewDistribution(id)
      setPreview(p)
    })
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Correr: {template.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Campaña de origen</label>
            <Select value={campaignId} onValueChange={handleCampaignChange}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná una campaña..." />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.week_label} · {c.rep_name} · {c.industry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {campaignId && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm">
              {loadingPreview ? (
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Calculando...</div>
              ) : preview ? (
                <>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total prospectos</span><span className="font-medium">{preview.total}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Ya enviados</span><span className="font-medium">{preview.previouslySent}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Disponibles</span><span className="font-semibold text-primary">{preview.total - preview.previouslySent}</span></div>
                </>
              ) : null}
            </div>
          )}

          {preview && preview.previouslySent > 0 && (
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={includePrev}
                onChange={(e) => setIncludePrev(e.target.checked)}
              />
              <span className="text-sm">
                <span className="font-medium">Incluir prospectos ya enviados</span>
                <span className="text-muted-foreground"> ({preview.previouslySent} prospectos)</span>
              </span>
            </label>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button
              className="flex-1"
              disabled={!campaignId}
              onClick={() => { onClose(); onRun(campaignId, includePrev) }}
            >
              <Play className="size-3.5 mr-1.5" /> Correr
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Run history ──────────────────────────────────────────────────────────────

function RunHistory({ runs }: { runs: DistributionRun[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (!runs.length) return (
    <p className="text-xs text-muted-foreground py-4 text-center">Sin corridas aún</p>
  )

  return (
    <div className="space-y-2">
      {runs.map((run, i) => {
        const results = run.results as RunResults | null
        const isExpanded = expanded === run.id
        return (
          <div key={run.id} className="border rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 text-left"
              onClick={() => setExpanded(isExpanded ? null : run.id)}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-mono">#{runs.length - i}</span>
                <span className="text-xs truncate max-w-[180px]">{run.source_campaign_label ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                {results && <span className="text-xs text-muted-foreground">{results.sent}/{results.total}</span>}
                {run.status === "done" && <CheckCircle2 className="size-3.5 text-green-600" />}
                {run.status === "running" && <Loader2 className="size-3.5 animate-spin text-blue-500" />}
                {run.status === "error" && <AlertCircle className="size-3.5 text-red-500" />}
                <span className="text-[10px] text-muted-foreground">
                  {new Date(run.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                </span>
              </div>
            </button>

            {isExpanded && results && (
              <div className="border-t px-3 py-2 space-y-1.5 bg-muted/10">
                {results.routes.map((r) => (
                  <div key={r.route_id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate max-w-[140px]">{r.name}</span>
                    <div className="flex items-center gap-3">
                      <span>{r.matched} matchearon</span>
                      {r.smartlead > 0 && <Badge variant="outline" className="text-[10px] py-0">SL: {r.smartlead}</Badge>}
                      {r.heyreach > 0 && <Badge variant="outline" className="text-[10px] py-0">HR: {r.heyreach}</Badge>}
                    </div>
                  </div>
                ))}
                {run.error && <p className="text-xs text-red-500">{run.error}</p>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Template editor ──────────────────────────────────────────────────────────

function TemplateEditor({ template, campaigns, onSaved, onClose }: {
  template: DistributionTemplate | null
  campaigns: { id: string; week_label: string; rep_name: string; industry: string; prospects_found: number | null }[]
  onSaved: (id: string) => void
  onClose: () => void
}) {
  const isNew = !template?.id
  const [name, setName] = useState(template?.name ?? "")
  const [industry, setIndustry] = useState(template?.industry ?? "")
  const [routes, setRoutes] = useState<DistributionRoute[]>(template?.routes ?? [])
  const [saving, startSave] = useTransition()
  const [running, startRun] = useTransition()
  const [showRunModal, setShowRunModal] = useState(false)
  const [runs, setRuns] = useState<DistributionRun[]>([])
  const [loadingRuns, startLoadRuns] = useTransition()
  const [runSuccess, setRunSuccess] = useState<string | null>(null)
  const [integrationCampaigns, setIntegrationCampaigns] = useState<{ smartlead: IntegrationCampaign[]; heyreach: IntegrationCampaign[] } | null>(null)
  const [loadingCampaigns, startLoadCampaigns] = useTransition()

  function addRoute() {
    setRoutes((prev) => [...prev, newRoute(prev.length)])
  }

  function updateRoute(index: number, route: DistributionRoute) {
    setRoutes((prev) => prev.map((r, i) => i === index ? route : r))
  }

  function moveRoute(index: number, direction: -1 | 1) {
    setRoutes((prev) => {
      const next = [...prev]
      const swap = index + direction
      if (swap < 0 || swap >= next.length) return prev
      ;[next[index], next[swap]] = [next[swap], next[index]]
      return next
    })
  }

  function removeRoute(index: number) {
    setRoutes((prev) => prev.filter((_, i) => i !== index))
  }

  function cloneRoute(index: number) {
    setRoutes((prev) => {
      const src = prev[index]
      const srcName = src.name ?? `Ruta ${index + 1}`
      const copy: DistributionRoute = {
        ...src,
        id: crypto.randomUUID(),
        name: `Copy ${srcName}`,
        conditions: src.conditions.map((g) => [...g]),
      }
      const next = [...prev]
      next.splice(index + 1, 0, copy)
      return next
    })
  }

  function handleLoadCampaigns() {
    startLoadCampaigns(async () => {
      const campaigns = await loadIntegrationCampaigns()
      setIntegrationCampaigns(campaigns)
    })
  }

  function handleSave() {
    startSave(async () => {
      const id = await saveTemplate({ id: template?.id, name, industry: industry || null, notes: null, routes })
      onSaved(id)
    })
  }

  useEffect(() => {
    if (!template?.id) return
    startLoadRuns(async () => {
      const r = await getRunsForTemplate(template.id)
      setRuns(r)
    })
  }, [template?.id])

  function handleLoadRuns() {
    if (!template?.id) return
    startLoadRuns(async () => {
      const r = await getRunsForTemplate(template.id)
      setRuns(r)
    })
  }

  function handleRun(campaignId: string, includePrev: boolean) {
    if (!template?.id) return
    startRun(async () => {
      await runDistribution(template.id, campaignId, includePrev)
      setRunSuccess("Distribución completada.")
      handleLoadRuns()
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="flex-1 space-y-1">
          <Input
            className="text-base font-semibold border-0 px-0 h-8 focus-visible:ring-0"
            placeholder="Nombre de la plantilla..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            className="text-xs border-0 px-0 h-6 focus-visible:ring-0 text-muted-foreground"
            placeholder="Industria (opcional)"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleLoadCampaigns} disabled={loadingCampaigns} title="Cargar campañas de Smartlead y HeyReach">
            {loadingCampaigns ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <RotateCcw className="size-3.5 mr-1" />}
            {integrationCampaigns ? `${integrationCampaigns.smartlead.length + integrationCampaigns.heyreach.length} campañas` : "Cargar campañas"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || !name}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {isNew ? "Crear" : "Guardar"}
          </Button>
          {!isNew && (
            <Button size="sm" onClick={() => setShowRunModal(true)} disabled={running}>
              {running ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Play className="size-3.5 mr-1.5" />}
              Run
            </Button>
          )}
        </div>
      </div>

      {runSuccess && (
        <div className="flex items-center gap-2 py-2 px-3 bg-green-50 dark:bg-green-950/20 rounded-lg text-sm text-green-700 dark:text-green-400 mt-3">
          <CheckCircle2 className="size-4 shrink-0" />
          {runSuccess}
        </div>
      )}

      {running && (
        <div className="flex items-center gap-2 py-2 px-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-sm text-blue-700 dark:text-blue-400 mt-3">
          <Loader2 className="size-4 shrink-0 animate-spin" />
          Distribuyendo prospectos...
        </div>
      )}

      {/* Routes */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {routes.map((route, i) => (
          <RouteCard
            key={route.id}
            route={route}
            index={i}
            total={routes.length}
            onChange={(r) => updateRoute(i, r)}
            onMoveUp={() => moveRoute(i, -1)}
            onMoveDown={() => moveRoute(i, 1)}
            onClone={() => cloneRoute(i)}
            onRemove={() => removeRoute(i)}
            integrationCampaigns={integrationCampaigns}
          />
        ))}
        <button
          onClick={addRoute}
          className="w-full border-2 border-dashed rounded-lg py-3 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="size-4" /> Agregar ruta
        </button>
      </div>

      {/* Run history */}
      {!isNew && (
        <div className="border-t pt-3">
          <button
            onClick={handleLoadRuns}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2"
          >
            <RotateCcw className={`size-3 ${loadingRuns ? "animate-spin" : ""}`} />
            Historial de corridas
          </button>
          <RunHistory runs={runs} />
        </div>
      )}

      {showRunModal && (
        <RunModal
          template={{ ...template!, name, routes }}
          campaigns={campaigns}
          onClose={() => setShowRunModal(false)}
          onRun={handleRun}
        />
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DistributionClient({ templates: initialTemplates, campaigns }: {
  templates: DistributionTemplate[]
  campaigns: { id: string; week_label: string; rep_name: string; industry: string; prospects_found: number | null }[]
}) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [selected, setSelected] = useState<DistributionTemplate | null | "new">(null)
  const [cloning, startClone] = useTransition()
  const [deleting, startDelete] = useTransition()

  function handleSaved(id: string) {
    startClone(async () => {
      const updated = await getTemplates()
      setTemplates(updated)
      const saved = updated.find((t) => t.id === id) ?? null
      setSelected(saved)
    })
  }

  function handleClone(templateId: string) {
    startClone(async () => {
      const newId = await cloneTemplate(templateId)
      const updated = await getTemplates()
      setTemplates(updated)
      const cloned = updated.find((t) => t.id === newId) ?? null
      setSelected(cloned)
    })
  }

  function handleDelete(templateId: string) {
    if (!confirm("¿Eliminár esta plantilla y todas sus corridas?")) return
    startDelete(async () => {
      await deleteTemplate(templateId)
      if ((selected as DistributionTemplate)?.id === templateId) setSelected(null)
      setTemplates((prev) => prev.filter((t) => t.id !== templateId))
    })
  }

  const selectedTemplate = selected === "new" ? null : selected

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0">
      {/* Left panel — template list */}
      <div className="w-72 border-r flex flex-col shrink-0">
        <div className="p-4 border-b flex items-center justify-between">
          <h1 className="font-semibold">Distribución</h1>
          <Button size="sm" variant="outline" onClick={() => setSelected("new")}>
            <Plus className="size-3.5 mr-1" /> Nueva
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y">
          {templates.length === 0 && (
            <p className="text-xs text-muted-foreground p-4 text-center">Sin plantillas. Creá la primera.</p>
          )}
          {templates.map((t) => {
            const isActive = (selected as DistributionTemplate)?.id === t.id
            return (
              <div
                key={t.id}
                className={`p-3 cursor-pointer hover:bg-muted/40 group ${isActive ? "bg-muted/60" : ""}`}
                onClick={() => setSelected(t)}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    {t.industry && <p className="text-xs text-muted-foreground">{t.industry}</p>}
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t.routes.length} {t.routes.length === 1 ? "ruta" : "rutas"}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleClone(t.id) }}
                      className="p-1 hover:text-primary"
                      title="Clonar"
                    >
                      {cloning ? <Loader2 className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(t.id) }}
                      className="p-1 hover:text-destructive"
                      title="Eliminar"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right panel — editor */}
      <div className="flex-1 overflow-hidden p-6">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Seleccioná una plantilla o creá una nueva
          </div>
        ) : (
          <TemplateEditor
            key={(selected as DistributionTemplate)?.id ?? "new"}
            template={selectedTemplate}
            campaigns={campaigns}
            onSaved={handleSaved}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  )
}
