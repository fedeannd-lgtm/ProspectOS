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
import { Button } from "@/components/ui/button"
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
  prospectado: "text-slate-500 dark:text-slate-400",
  contactado: "text-blue-600 dark:text-blue-400",
  respuesta: "text-yellow-600 dark:text-yellow-500",
  interesado: "text-orange-600 dark:text-orange-400",
  agendado: "text-purple-600 dark:text-purple-400",
  ganado: "text-green-600 dark:text-green-400",
}

const STAGE_CHIP_ACTIVE: Record<Stage, string> = {
  prospectado: "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200",
  contactado: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
  respuesta: "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200",
  interesado: "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200",
  agendado: "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200",
  ganado: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
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
        {rep && <span className="shrink-0 text-[10px] font-semibold bg-muted text-muted-foreground rounded px-1.5 py-0.5">{repInitials(rep)}</span>}
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
        {rep && <span className="shrink-0 text-[10px] font-semibold bg-muted text-muted-foreground rounded px-1.5 py-0.5">{repInitials(rep)}</span>}
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

function KanbanColumn({ stage, items, visible }: { stage: Stage; items: FunnelItem[]; visible: boolean }) {
  if (!visible) return null
  const ids = items.map((i) => i.id)
  return (
    <div className="flex flex-col shrink-0 w-[240px]">
      <div className="flex items-center justify-between mb-2 px-0.5">
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
  const [visibleStages, setVisibleStages] = useState<Set<Stage>>(new Set(STAGES))
  const [items, setItems] = useState<FunnelItem[]>([])
  const [activeItem, setActiveItem] = useState<FunnelItem | null>(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isLoadingMore, startLoadingMore] = useTransition()

  const load = useCallback((type: EntityType, r: string, s: string, off: number, append: boolean) => {
    startTransition(async () => {
      try {
        if (type === "personas") {
          const { items: data, hasMore: more } = await getFunnelProspects({ rep: r, search: s, offset: off })
          const mapped = data.map((p) => ({ ...p, _type: "personas" as const }))
          setItems((prev) => append ? [...prev, ...mapped] : mapped)
          setHasMore(more)
        } else {
          const { items: data, hasMore: more } = await getFunnelAccounts({ rep: r, search: s, offset: off })
          const mapped = data.map((a) => ({ ...a, _type: "empresas" as const }))
          setItems((prev) => append ? [...prev, ...mapped] : mapped)
          setHasMore(more)
        }
      } catch (e) {
        console.error("[FunnelView] load error", e)
      } finally {
        setLoaded(true)
      }
    })
  }, [])

  // Reset and reload when entity type, rep changes
  useEffect(() => {
    setOffset(0)
    setItems([])
    setLoaded(false)
    load(entityType, rep, search, 0, false)
  }, [entityType, rep]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => {
      setOffset(0)
      load(entityType, rep, search, 0, false)
    }, 400)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  function loadMore() {
    const newOffset = offset + 500
    setOffset(newOffset)
    startLoadingMore(async () => {
      load(entityType, rep, search, newOffset, true)
    })
  }

  function toggleStage(stage: Stage) {
    setVisibleStages((prev) => {
      const next = new Set(prev)
      if (next.has(stage)) {
        if (next.size === 1) return prev // keep at least one
        next.delete(stage)
      } else {
        next.add(stage)
      }
      return next
    })
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragStart(e: DragStartEvent) {
    const found = items.find((i) => i.id === e.active.id)
    if (found) setActiveItem(found)
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveItem(null)
    const { active, over } = e
    if (!over || active.id === over.id) return

    const targetStage = STAGES.includes(over.id as Stage)
      ? (over.id as Stage)
      : items.find((i) => i.id === over.id)?.funnel_stage as Stage | undefined

    if (!targetStage) return
    const draggedItem = items.find((i) => i.id === active.id)
    if (!draggedItem || draggedItem.funnel_stage === targetStage) return

    setItems((prev) => prev.map((i) => i.id === active.id ? { ...i, funnel_stage: targetStage } : i))

    if (draggedItem._type === "personas") {
      updateProspectFunnelStage(active.id as string, targetStage).catch(() => {
        setItems((prev) => prev.map((i) => i.id === active.id ? { ...i, funnel_stage: draggedItem.funnel_stage } : i))
      })
    } else {
      updateAccountFunnelStage(active.id as string, targetStage).catch(() => {
        setItems((prev) => prev.map((i) => i.id === active.id ? { ...i, funnel_stage: draggedItem.funnel_stage } : i))
      })
    }
  }

  const byStage = (stage: Stage) => items.filter((i) => i.funnel_stage === stage)
  const totalVisible = items.filter((i) => visibleStages.has(i.funnel_stage as Stage)).length

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: entity toggle + rep filter + search */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex border rounded-md overflow-hidden text-sm">
          <button
            onClick={() => setEntityType("personas")}
            className={`px-3 py-1.5 transition-colors ${entityType === "personas" ? "bg-foreground text-background" : "hover:bg-muted/50"}`}
          >
            Personas
          </button>
          <button
            onClick={() => setEntityType("empresas")}
            className={`px-3 py-1.5 border-l transition-colors ${entityType === "empresas" ? "bg-foreground text-background" : "hover:bg-muted/50"}`}
          >
            Empresas
          </button>
        </div>

        <Select value={rep} onValueChange={(v) => setRep(v ?? "all")}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue placeholder="Todos los reps" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los reps</SelectItem>
            {reps.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={entityType === "personas" ? "Buscar contacto o empresa…" : "Buscar empresa…"}
          className="h-8 text-sm w-52"
        />

        {isPending && <span className="text-xs text-muted-foreground">Cargando…</span>}
        {loaded && !isPending && <span className="text-xs text-muted-foreground tabular-nums">{totalVisible} de {items.length} mostrados</span>}
      </div>

      {/* Row 2: stage filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {STAGES.map((stage) => {
          const active = visibleStages.has(stage)
          const count = byStage(stage).length
          return (
            <button
              key={stage}
              onClick={() => toggleStage(stage)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                active ? STAGE_CHIP_ACTIVE[stage] + " border-transparent" : "border-border text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {STAGE_LABELS[stage]}
              <span className="tabular-nums opacity-70">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Board */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {STAGES.map((stage) => (
            <KanbanColumn key={stage} stage={stage} items={byStage(stage)} visible={visibleStages.has(stage)} />
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

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-1 pb-4">
          <Button variant="outline" size="sm" onClick={loadMore} disabled={isLoadingMore || isPending}>
            {isLoadingMore ? "Cargando…" : "Cargar 500 más"}
          </Button>
        </div>
      )}
    </div>
  )
}
