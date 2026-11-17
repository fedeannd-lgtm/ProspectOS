"use client"

import { useState, useTransition, useEffect, useCallback } from "react"
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { getFunnelProspects, getFunnelAccounts, updateProspectFunnelStage, updateAccountFunnelStage, type FunnelProspect, type FunnelAccount } from "./actions"

const STAGES = ["prospectado", "contactado", "respuesta", "interesado", "agendado", "ganado"] as const
type Stage = typeof STAGES[number]

const STAGE_LABELS: Record<Stage, string> = {
  prospectado: "Prospectado",
  contactado: "Contactado",
  respuesta: "Respuesta",
  interesado: "Interesado",
  agendado: "Agendado",
  ganado: "Ganado",
}

const STAGE_COLORS: Record<Stage, string> = {
  prospectado: "bg-slate-100 dark:bg-slate-800",
  contactado: "bg-blue-50 dark:bg-blue-950/40",
  respuesta: "bg-yellow-50 dark:bg-yellow-950/40",
  interesado: "bg-orange-50 dark:bg-orange-950/40",
  agendado: "bg-purple-50 dark:bg-purple-950/40",
  ganado: "bg-green-50 dark:bg-green-950/40",
}

const STAGE_HEADER_COLORS: Record<Stage, string> = {
  prospectado: "text-slate-600 dark:text-slate-400",
  contactado: "text-blue-600 dark:text-blue-400",
  respuesta: "text-yellow-600 dark:text-yellow-500",
  interesado: "text-orange-600 dark:text-orange-400",
  agendado: "text-purple-600 dark:text-purple-400",
  ganado: "text-green-600 dark:text-green-400",
}

type EntityType = "personas" | "empresas"
type FunnelItem = (FunnelProspect | FunnelAccount) & { _type: EntityType }

function repInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
}

function ProspectCard({ item, isDragging }: { item: FunnelProspect & { _type: "personas" }; isDragging?: boolean }) {
  const rep = item.campaigns?.rep_name ?? ""
  return (
    <div className={`bg-background border rounded-md p-2.5 select-none ${isDragging ? "shadow-lg opacity-80" : "shadow-sm hover:shadow-md transition-shadow"}`}>
      <div className="flex items-start justify-between gap-1.5">
        <span className="text-[13px] font-medium leading-tight line-clamp-1">{item.full_name ?? "—"}</span>
        {rep && (
          <span className="shrink-0 text-[10px] font-semibold bg-muted text-muted-foreground rounded px-1.5 py-0.5">{repInitials(rep)}</span>
        )}
      </div>
      {item.job_title && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{item.job_title}</p>}
      {item.company_name && <p className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-1">{item.company_name}</p>}
    </div>
  )
}

function AccountCard({ item, isDragging }: { item: FunnelAccount & { _type: "empresas" }; isDragging?: boolean }) {
  const rep = item.campaigns?.rep_name ?? ""
  const meta = [item.industry, item.headcount_range].filter(Boolean).join(" · ")
  return (
    <div className={`bg-background border rounded-md p-2.5 select-none ${isDragging ? "shadow-lg opacity-80" : "shadow-sm hover:shadow-md transition-shadow"}`}>
      <div className="flex items-start justify-between gap-1.5">
        <span className="text-[13px] font-medium leading-tight line-clamp-1">{item.company_name}</span>
        {rep && (
          <span className="shrink-0 text-[10px] font-semibold bg-muted text-muted-foreground rounded px-1.5 py-0.5">{repInitials(rep)}</span>
        )}
      </div>
      {meta && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{meta}</p>}
    </div>
  )
}

function SortableCard({ item }: { item: FunnelItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
      {item._type === "personas"
        ? <ProspectCard item={item as FunnelProspect & { _type: "personas" }} />
        : <AccountCard item={item as FunnelAccount & { _type: "empresas" }} />}
    </div>
  )
}

function KanbanColumn({ stage, items }: { stage: Stage; items: FunnelItem[] }) {
  const ids = items.map((i) => i.id)
  return (
    <div className="flex flex-col shrink-0 w-[240px]">
      <div className={`flex items-center justify-between mb-2 px-0.5`}>
        <span className={`text-xs font-semibold uppercase tracking-wide ${STAGE_HEADER_COLORS[stage]}`}>{STAGE_LABELS[stage]}</span>
        <span className="text-xs text-muted-foreground font-medium tabular-nums">{items.length}</span>
      </div>
      <div className={`flex-1 min-h-[200px] rounded-lg p-2 ${STAGE_COLORS[stage]}`}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <SortableCard key={item.id} item={item} />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  )
}

export function FunnelView({ reps }: { reps: string[] }) {
  const [entityType, setEntityType] = useState<EntityType>("personas")
  const [rep, setRep] = useState("all")
  const [search, setSearch] = useState("")
  const [items, setItems] = useState<FunnelItem[]>([])
  const [activeItem, setActiveItem] = useState<FunnelItem | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()

  const load = useCallback((type: EntityType, r: string, s: string) => {
    startTransition(async () => {
      try {
        if (type === "personas") {
          const data = await getFunnelProspects({ rep: r, search: s })
          setItems(data.map((p) => ({ ...p, _type: "personas" as const })))
        } else {
          const data = await getFunnelAccounts({ rep: r, search: s })
          setItems(data.map((a) => ({ ...a, _type: "empresas" as const })))
        }
      } catch (e) {
        console.error("[FunnelView] load error", e)
      } finally {
        setLoaded(true)
      }
    })
  }, [])

  useEffect(() => { load(entityType, rep, search) }, [entityType, rep]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => load(entityType, rep, search), 400)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragStart(e: DragStartEvent) {
    const found = items.find((i) => i.id === e.active.id)
    if (found) setActiveItem(found)
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveItem(null)
    const { active, over } = e
    if (!over || active.id === over.id) return

    // Determine target stage: over.id is either an item id or a column stage id
    const targetStage = STAGES.includes(over.id as Stage)
      ? (over.id as Stage)
      : items.find((i) => i.id === over.id)?.funnel_stage as Stage | undefined

    if (!targetStage) return
    const draggedItem = items.find((i) => i.id === active.id)
    if (!draggedItem || draggedItem.funnel_stage === targetStage) return

    // Optimistic update
    setItems((prev) => prev.map((i) => i.id === active.id ? { ...i, funnel_stage: targetStage } : i))

    // Persist
    if (draggedItem._type === "personas") {
      updateProspectFunnelStage(active.id as string, targetStage).catch(() => {
        // Revert on error
        setItems((prev) => prev.map((i) => i.id === active.id ? { ...i, funnel_stage: draggedItem.funnel_stage } : i))
      })
    } else {
      updateAccountFunnelStage(active.id as string, targetStage).catch(() => {
        setItems((prev) => prev.map((i) => i.id === active.id ? { ...i, funnel_stage: draggedItem.funnel_stage } : i))
      })
    }
  }

  const byStage = (stage: Stage) => items.filter((i) => i.funnel_stage === stage)

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Entity toggle */}
        <div className="flex border rounded-md overflow-hidden text-sm">
          <button
            onClick={() => { setEntityType("personas"); setLoaded(false) }}
            className={`px-3 py-1.5 transition-colors ${entityType === "personas" ? "bg-foreground text-background" : "hover:bg-muted/50"}`}
          >
            Personas
          </button>
          <button
            onClick={() => { setEntityType("empresas"); setLoaded(false) }}
            className={`px-3 py-1.5 border-l transition-colors ${entityType === "empresas" ? "bg-foreground text-background" : "hover:bg-muted/50"}`}
          >
            Empresas
          </button>
        </div>

        {/* Rep filter */}
        <Select value={rep} onValueChange={(v) => setRep(v ?? "all")}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue placeholder="Todos los reps" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los reps</SelectItem>
            {reps.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Search */}
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={entityType === "personas" ? "Buscar contacto o empresa…" : "Buscar empresa…"}
          className="h-8 text-sm w-52"
        />

        {isPending && <span className="text-xs text-muted-foreground">Cargando…</span>}
      </div>

      {/* Board */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map((stage) => (
            <KanbanColumn key={stage} stage={stage} items={byStage(stage)} />
          ))}
        </div>
        <DragOverlay>
          {activeItem ? (
            activeItem._type === "personas"
              ? <ProspectCard item={activeItem as FunnelProspect & { _type: "personas" }} isDragging />
              : <AccountCard item={activeItem as FunnelAccount & { _type: "empresas" }} isDragging />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
