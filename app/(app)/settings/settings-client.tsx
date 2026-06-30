"use client"

import { useState, useTransition, useMemo } from "react"
import { CheckCircle2, XCircle, Loader2, Eye, EyeOff, Plus, Trash2, Copy, Check, Link2, AlertTriangle, AlertCircle, MinusCircle, Activity } from "lucide-react"
import type { ProviderStatus } from "./provider-status"
import type { ProviderUsage } from "./actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { upsertRepCookie, createSavedUrl, deleteSavedUrl, type SavedUrl } from "./actions"

const REPS = ["Alu", "Fede", "Guido", "Suva", "Jess"]
const INDUSTRIES = [
  "Retail & Comercio",
  "Manufactura",
  "Finance & Insurance",
  "Agro & Energy",
  "Construcción",
  "BPO & Professional Services",
  "Health & Entertainment",
  "Consulting & Telco",
]
const URL_TYPE_LABELS: Record<string, string> = {
  company_search: "Company Search",
  people_search: "People Search",
}

type RepConfig = {
  rep_name: string
  linkedin_cookie: string | null
  updated_at: string | null
}

// ─── LinkedIn cookie row ──────────────────────────────────────────────────────

function RepRow({ config }: { config: RepConfig }) {
  const [editing, setEditing] = useState(false)
  const [cookieInput, setCookieInput] = useState("")
  const [showCookie, setShowCookie] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  function handleSave() {
    if (!cookieInput.trim()) return
    setError("")
    startTransition(async () => {
      try {
        await upsertRepCookie(config.rep_name, cookieInput.trim())
        setSaved(true)
        setEditing(false)
        setCookieInput("")
        setTimeout(() => setSaved(false), 3000)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error guardando cookie")
      }
    })
  }

  const maskedCookie = config.linkedin_cookie
    ? `●●●●●●●●●●●●●●●● …${config.linkedin_cookie.slice(-12)}`
    : null

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-semibold">
            {config.rep_name[0]}
          </div>
          <div>
            <p className="text-sm font-medium">{config.rep_name}</p>
            {config.updated_at && !saved && (
              <p className="text-xs text-muted-foreground">
                Actualizado {new Date(config.updated_at).toLocaleDateString("es", {
                  day: "numeric", month: "short", year: "numeric"
                })}
              </p>
            )}
            {saved && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="size-3" /> Guardado
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {config.linkedin_cookie ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              <CheckCircle2 className="size-3" /> Cookie activa
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
              <XCircle className="size-3" /> Sin cookie
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => { setEditing((v) => !v); setCookieInput(""); setError("") }}
          >
            {editing ? "Cancelar" : config.linkedin_cookie ? "Actualizar" : "Agregar"}
          </Button>
        </div>
      </div>

      {config.linkedin_cookie && !editing && (
        <div className="flex items-center gap-2">
          <p className="font-mono text-xs text-muted-foreground flex-1 truncate">
            {showCookie ? config.linkedin_cookie : maskedCookie}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 shrink-0"
            onClick={() => setShowCookie((v) => !v)}
          >
            {showCookie ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
          </Button>
        </div>
      )}

      {editing && (
        <div className="space-y-2">
          <Input
            value={cookieInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCookieInput(e.target.value)}
            placeholder="Pegá la cookie de LinkedIn Sales Navigator aquí..."
            className="font-mono text-xs"
            type="password"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button size="sm" onClick={handleSave} disabled={isPending || !cookieInput.trim()}>
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Guardar cookie"}
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Saved URL row ────────────────────────────────────────────────────────────

function UrlRow({ url, onDelete }: { url: SavedUrl; onDelete: () => void }) {
  const [copied, setCopied] = useState(false)
  const [deleting, startDelete] = useTransition()

  function handleCopy() {
    navigator.clipboard.writeText(url.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDelete() {
    startDelete(async () => {
      await deleteSavedUrl(url.id)
      onDelete()
    })
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <Link2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{url.rep_name}</span>
          <Badge variant="outline" className="text-xs font-normal">{url.industry}</Badge>
          <Badge
            variant="secondary"
            className={`text-xs font-normal ${url.url_type === "company_search" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}
          >
            {URL_TYPE_LABELS[url.url_type]}
          </Badge>
          {url.label && <span className="text-xs text-muted-foreground">— {url.label}</span>}
        </div>
        <p className="text-xs text-muted-foreground font-mono truncate">{url.url}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopy}>
          {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
        </Button>
      </div>
    </div>
  )
}

// ─── Add URL form ─────────────────────────────────────────────────────────────

type NewUrlForm = {
  rep_name: string
  industry: string
  url_type: "company_search" | "people_search" | ""
  url: string
  label: string
}

const EMPTY_URL_FORM: NewUrlForm = { rep_name: "", industry: "", url_type: "", url: "", label: "" }

function AddUrlForm({ onAdded }: { onAdded: (url: SavedUrl) => void }) {
  const [form, setForm] = useState<NewUrlForm>(EMPTY_URL_FORM)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")

  const isValid = form.rep_name && form.industry && form.url_type && form.url.trim()

  function handleSubmit() {
    if (!isValid) return
    setError("")
    startTransition(async () => {
      try {
        const created = await createSavedUrl({
          rep_name: form.rep_name,
          industry: form.industry,
          url_type: form.url_type as "company_search" | "people_search",
          url: form.url.trim(),
          label: form.label.trim() || null,
        })
        setForm(EMPTY_URL_FORM)
        onAdded(created)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error guardando URL")
      }
    })
  }

  return (
    <div className="rounded-lg border border-dashed p-4 space-y-3 bg-muted/30">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nueva URL</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Select value={form.rep_name} onValueChange={(v) => { if (v) setForm((f) => ({ ...f, rep_name: v })) }}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="SDR" />
          </SelectTrigger>
          <SelectContent>
            {REPS.map((r) => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={form.industry} onValueChange={(v) => { if (v) setForm((f) => ({ ...f, industry: v })) }}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Industria" />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map((i) => <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={form.url_type} onValueChange={(v) => { if (v) setForm((f) => ({ ...f, url_type: v as NewUrlForm["url_type"] })) }}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="company_search" className="text-xs">Company Search</SelectItem>
            <SelectItem value="people_search" className="text-xs">People Search</SelectItem>
          </SelectContent>
        </Select>

        <Input
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          placeholder="Etiqueta (opcional)"
          className="h-8 text-xs"
        />
      </div>

      <div className="flex gap-2">
        <Input
          value={form.url}
          onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          placeholder="https://www.linkedin.com/sales/search/..."
          className="h-8 text-xs font-mono flex-1"
        />
        <Button
          size="sm"
          className="h-8 shrink-0"
          onClick={handleSubmit}
          disabled={!isValid || isPending}
        >
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <><Plus className="size-3.5 mr-1" />Guardar</>}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ─── Saved URLs card ──────────────────────────────────────────────────────────

function SavedUrlsCard({ initialUrls }: { initialUrls: SavedUrl[] }) {
  const [urls, setUrls] = useState<SavedUrl[]>(initialUrls)
  const [showAdd, setShowAdd] = useState(false)
  const [filterRep, setFilterRep] = useState("all")
  const [filterIndustry, setFilterIndustry] = useState("all")
  const [filterType, setFilterType] = useState("all")

  const filtered = useMemo(() => {
    return urls.filter((u) => {
      if (filterRep !== "all" && u.rep_name !== filterRep) return false
      if (filterIndustry !== "all" && u.industry !== filterIndustry) return false
      if (filterType !== "all" && u.url_type !== filterType) return false
      return true
    })
  }, [urls, filterRep, filterIndustry, filterType])

  function handleDelete(id: string) {
    setUrls((prev) => prev.filter((u) => u.id !== id))
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Repositorio de URLs</CardTitle>
            <CardDescription>
              URLs de Company Search y People Search guardadas por SDR e industria.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setShowAdd((v) => !v)}
          >
            {showAdd ? "Cancelar" : <><Plus className="size-3.5 mr-1" />Agregar URL</>}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAdd && (
          <AddUrlForm onAdded={(newUrl) => {
            setUrls((prev) => [...prev, newUrl])
            setShowAdd(false)
          }} />
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={filterRep} onValueChange={(v) => { if (v) setFilterRep(v) }}>
            <SelectTrigger className="h-7 w-[110px] text-xs">
              <SelectValue placeholder="SDR" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos los SDR</SelectItem>
              {REPS.map((r) => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterIndustry} onValueChange={(v) => { if (v) setFilterIndustry(v) }}>
            <SelectTrigger className="h-7 w-[160px] text-xs">
              <SelectValue placeholder="Industria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todas las industrias</SelectItem>
              {INDUSTRIES.map((i) => <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={(v) => { if (v) setFilterType(v) }}>
            <SelectTrigger className="h-7 w-[140px] text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos los tipos</SelectItem>
              <SelectItem value="company_search" className="text-xs">Company Search</SelectItem>
              <SelectItem value="people_search" className="text-xs">People Search</SelectItem>
            </SelectContent>
          </Select>

          {(filterRep !== "all" || filterIndustry !== "all" || filterType !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => { setFilterRep("all"); setFilterIndustry("all"); setFilterType("all") }}
            >
              Limpiar filtros
            </Button>
          )}
        </div>

        {/* URL list */}
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {urls.length === 0 ? "No hay URLs guardadas todavía." : "Ninguna URL coincide con los filtros."}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((u) => (
              <UrlRow key={u.id} url={u} onDelete={() => handleDelete(u.id)} />
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {filtered.length} URL{filtered.length !== 1 ? "s" : ""}
            {urls.length !== filtered.length ? ` de ${urls.length}` : ""}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

const STATUS_CFG = {
  ok:           { icon: CheckCircle2, cls: "text-green-600",  bg: "bg-green-50",  label: "OK" },
  low:          { icon: AlertTriangle, cls: "text-yellow-600", bg: "bg-yellow-50", label: "Pocos créditos" },
  out:          { icon: AlertCircle,   cls: "text-red-600",    bg: "bg-red-50",    label: "Sin créditos" },
  unconfigured: { icon: MinusCircle,   cls: "text-zinc-400",   bg: "bg-zinc-50",   label: "No configurado" },
  error:        { icon: XCircle,       cls: "text-red-600",    bg: "bg-red-50",    label: "Error" },
}

function ProviderRow({ p }: { p: ProviderStatus }) {
  const cfg = STATUS_CFG[p.status]
  const Icon = cfg.icon
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <Icon className={`size-4 ${cfg.cls}`} />
        <span className="text-sm font-medium">{p.label}</span>
      </div>
      <div className="flex items-center gap-2">
        {p.credits != null && (
          <span className="text-xs text-muted-foreground">{p.credits.toLocaleString()} créditos</span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.cls}`}>
          {p.detail}
        </span>
      </div>
    </div>
  )
}

export function SettingsClient({ configs, savedUrls, providerStatus, providerUsage }: {
  configs: RepConfig[]
  savedUrls: SavedUrl[]
  providerStatus: ProviderStatus[]
  providerUsage: ProviderUsage[]
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Configuración de cookies y URLs por SDR.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado de providers</CardTitle>
          <CardDescription>Créditos disponibles por servicio de enriquecimiento.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {providerStatus.map((p) => <ProviderRow key={p.name} p={p} />)}
        </CardContent>
      </Card>

      {providerUsage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4" /> Consumo por provider
            </CardTitle>
            <CardDescription>Emails encontrados exitosamente por cada servicio.</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="pb-2 text-left font-medium">Provider</th>
                  <th className="pb-2 text-right font-medium">Hoy</th>
                  <th className="pb-2 text-right font-medium">7 días</th>
                  <th className="pb-2 text-right font-medium">Este mes</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {providerUsage.map((u) => (
                  <tr key={u.provider}>
                    <td className="py-2 font-medium">{u.label}</td>
                    <td className="py-2 text-right tabular-nums">{u.today || "—"}</td>
                    <td className="py-2 text-right tabular-nums">{u.week || "—"}</td>
                    <td className="py-2 text-right tabular-nums">{u.month || "—"}</td>
                    <td className="py-2 text-right tabular-nums font-medium">{u.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cookies por SDR</CardTitle>
          <CardDescription>
            Copiá la cookie desde las DevTools de tu browser mientras estás logueado en Sales Navigator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {configs.map((c) => (
            <RepRow key={c.rep_name} config={c} />
          ))}
        </CardContent>
      </Card>

      <SavedUrlsCard initialUrls={savedUrls} />
    </div>
  )
}
