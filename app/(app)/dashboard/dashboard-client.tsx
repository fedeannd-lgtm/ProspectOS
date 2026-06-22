"use client"

import { useState, useTransition, useMemo } from "react"
import { Plus, Pencil, Trash2, Building2, Users, Send, Zap, LayoutList, CalendarDays } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createCampaign, updateCampaign, deleteCampaign } from "./actions"

type CampaignStatus = "pending" | "searching" | "enriching" | "distributing" | "done"

type Campaign = {
  id: string
  week_label: string
  rep_name: string
  industry: string
  status: CampaignStatus
  accounts_found: number
  prospects_found: number
  prospects_sent: number
  notes: string | null
}

type FormData = {
  week_label: string
  rep_name: string
  industry: string
  notes: string
}

const REPS = ["Todos", "Alu", "Fede", "Guido", "Suva", "Jess"]
const REP_OPTIONS = ["Alu", "Fede", "Guido", "Suva", "Jess"]
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

const STATUS_LABELS: Record<CampaignStatus, string> = {
  pending: "Pendiente",
  searching: "Buscando",
  enriching: "Enriqueciendo",
  distributing: "Distribuyendo",
  done: "Listo",
}

const STATUS_CLASSES: Record<CampaignStatus, string> = {
  pending: "bg-zinc-100 text-zinc-600 border border-zinc-200",
  searching: "bg-blue-50 text-blue-700 border border-blue-200",
  enriching: "bg-amber-50 text-amber-700 border border-amber-200",
  distributing: "bg-violet-50 text-violet-700 border border-violet-200",
  done: "bg-green-50 text-green-700 border border-green-200",
}

const EMPTY_FORM: FormData = {
  week_label: "S24 - 2026-06-08",
  rep_name: "",
  industry: "",
  notes: "",
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function CampaignTable({
  campaigns,
  onEdit,
  onDelete,
  isPending,
}: {
  campaigns: Campaign[]
  onEdit: (c: Campaign) => void
  onDelete: (id: string) => void
  isPending: boolean
}) {
  if (campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Sin campañas
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Semana</TableHead>
          <TableHead>Rep</TableHead>
          <TableHead>Industria</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Empresas</TableHead>
          <TableHead className="text-right">Prospectos</TableHead>
          <TableHead className="text-right">Enviados</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {campaigns.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium whitespace-nowrap">{c.week_label}</TableCell>
            <TableCell>{c.rep_name}</TableCell>
            <TableCell className="max-w-[160px] truncate">{c.industry}</TableCell>
            <TableCell><StatusBadge status={c.status} /></TableCell>
            <TableCell className="text-right tabular-nums">{c.accounts_found}</TableCell>
            <TableCell className="text-right tabular-nums">{c.prospects_found}</TableCell>
            <TableCell className="text-right tabular-nums">{c.prospects_sent}</TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-1">
                <Button variant="ghost" size="icon" className="size-8" onClick={() => onEdit(c)} disabled={isPending}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => onDelete(c.id)} disabled={isPending}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function WeeklyView({ campaigns }: { campaigns: Campaign[] }) {
  const weeks = useMemo(() => {
    const map = new Map<string, Campaign[]>()
    campaigns.forEach((c) => {
      const key = c.week_label
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    })
    // Sort weeks descending by label
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [campaigns])

  if (weeks.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Sin campañas
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {weeks.map(([week, cams]) => {
        const totalAccounts = cams.reduce((s, c) => s + c.accounts_found, 0)
        const totalProspects = cams.reduce((s, c) => s + c.prospects_found, 0)
        const totalSent = cams.reduce((s, c) => s + c.prospects_sent, 0)
        return (
          <div key={week}>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="font-semibold text-base">{week}</h3>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Building2 className="size-3" />{totalAccounts} empresas</span>
                <span className="flex items-center gap-1"><Users className="size-3" />{totalProspects} prospectos</span>
                <span className="flex items-center gap-1"><Send className="size-3" />{totalSent} enviados</span>
              </div>
              <div className="flex-1 border-t" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cams.map((c) => (
                <Link key={c.id} href={`/campaigns/${c.id}`}>
                  <div className="rounded-lg border p-3.5 hover:bg-muted/40 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-medium text-sm">{c.rep_name}</p>
                        <p className="text-xs text-muted-foreground">{c.industry}</p>
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="size-3" />
                        {c.accounts_found}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="size-3" />
                        {c.prospects_found}
                      </span>
                      <span className="flex items-center gap-1">
                        <Send className="size-3" />
                        {c.prospects_sent}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function DashboardClient({ initialCampaigns }: { initialCampaigns: Campaign[] }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns)
  const [view, setView] = useState<"list" | "weekly">("list")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [isPending, startTransition] = useTransition()

  const kpis = {
    active: campaigns.filter((c) => c.status !== "done" && c.status !== "pending").length,
    accounts: campaigns.reduce((s, c) => s + c.accounts_found, 0),
    prospects: campaigns.reduce((s, c) => s + c.prospects_found, 0),
    sent: campaigns.reduce((s, c) => s + c.prospects_sent, 0),
  }

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(c: Campaign) {
    setEditingId(c.id)
    setForm({ week_label: c.week_label, rep_name: c.rep_name, industry: c.industry, notes: c.notes ?? "" })
    setDialogOpen(true)
  }

  function handleSave() {
    if (!form.rep_name || !form.industry || !form.week_label) return
    startTransition(async () => {
      if (editingId) {
        await updateCampaign(editingId, form)
        setCampaigns((prev) => prev.map((c) => c.id === editingId ? { ...c, ...form } : c))
      } else {
        await createCampaign(form)
        const newCampaign: Campaign = {
          id: crypto.randomUUID(),
          ...form,
          status: "pending",
          accounts_found: 0,
          prospects_found: 0,
          prospects_sent: 0,
        }
        setCampaigns((prev) => [newCampaign, ...prev])
      }
      setDialogOpen(false)
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteCampaign(id)
      setCampaigns((prev) => prev.filter((c) => c.id !== id))
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Planning semanal de campañas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border">
            <button
              onClick={() => setView("list")}
              className={`px-2.5 py-1.5 rounded-l-md transition-colors ${view === "list" ? "bg-foreground text-background" : "hover:bg-muted/50"}`}
              title="Vista lista"
            >
              <LayoutList className="size-4" />
            </button>
            <button
              onClick={() => setView("weekly")}
              className={`px-2.5 py-1.5 rounded-r-md border-l transition-colors ${view === "weekly" ? "bg-foreground text-background" : "hover:bg-muted/50"}`}
              title="Vista semanal"
            >
              <CalendarDays className="size-4" />
            </button>
          </div>
          <Button onClick={openCreate} disabled={isPending}>
            <Plus className="mr-2 size-4" />
            Nueva campaña
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">En curso</CardTitle>
            <Zap className="size-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{kpis.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Empresas</CardTitle>
            <Building2 className="size-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{kpis.accounts.toLocaleString("es")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Prospectos</CardTitle>
            <Users className="size-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{kpis.prospects.toLocaleString("es")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Enviados</CardTitle>
            <Send className="size-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{kpis.sent.toLocaleString("es")}</div>
          </CardContent>
        </Card>
      </div>

      {view === "weekly" && <WeeklyView campaigns={campaigns} />}

      {view === "list" && <Tabs defaultValue="Todos">
        <TabsList>
          {REPS.map((r) => (
            <TabsTrigger key={r} value={r}>{r}</TabsTrigger>
          ))}
        </TabsList>
        {REPS.map((r) => {
          const tab = r === "Todos" ? campaigns : campaigns.filter((c) => c.rep_name === r)
          return (
            <TabsContent key={r} value={r} className="mt-3">
              <CampaignTable campaigns={tab} onEdit={openEdit} onDelete={handleDelete} isPending={isPending} />
            </TabsContent>
          )
        })}
      </Tabs>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar campaña" : "Nueva campaña"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Semana</label>
              <Input
                value={form.week_label}
                onChange={(e) => setForm((f) => ({ ...f, week_label: e.target.value }))}
                placeholder="S24 - 2026-06-08"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Rep</label>
              <Select value={form.rep_name} onValueChange={(v) => setForm((f) => ({ ...f, rep_name: v ?? "" }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar rep" /></SelectTrigger>
                <SelectContent>
                  {REP_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Industria</label>
              <Select value={form.industry} onValueChange={(v) => setForm((f) => ({ ...f, industry: v ?? "" }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar industria" /></SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Notas (opcional)</label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Notas..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isPending || !form.rep_name || !form.industry || !form.week_label}>
              {isPending ? "Guardando..." : editingId ? "Guardar cambios" : "Crear campaña"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
