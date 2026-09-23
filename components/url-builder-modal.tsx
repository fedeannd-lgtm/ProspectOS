"use client"

import { useState, useTransition } from "react"
import { Sparkles, Copy, Check, Loader2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { generateSalesNavUrl } from "@/app/(app)/settings/url-builder-action"

export function UrlBuilderButton({ type }: { type: "company" | "people" }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" variant="outline" type="button" onClick={() => setOpen(true)}>
        <Sparkles className="mr-1.5 size-3.5" />
        Armar URL con IA
      </Button>
      <UrlBuilderModal type={type} open={open} onOpenChange={setOpen} />
    </>
  )
}

export function UrlBuilderModal({
  type,
  open,
  onOpenChange,
}: {
  type: "company" | "people"
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [description, setDescription] = useState("")
  const [result, setResult] = useState<{ url: string; error?: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleGenerate() {
    if (!description.trim()) return
    setResult(null)
    startTransition(async () => {
      const res = await generateSalesNavUrl(type, description)
      setResult(res)
    })
  }

  function handleCopy() {
    if (!result?.url) return
    navigator.clipboard.writeText(result.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleClose(v: boolean) {
    if (!v) {
      setDescription("")
      setResult(null)
      setCopied(false)
    }
    onOpenChange(v)
  }

  const label = type === "company" ? "Company Search" : "People Search"

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-violet-500" />
            Armar URL con IA — {label}
          </DialogTitle>
          <DialogDescription>
            Describí en lenguaje natural lo que estás buscando y la IA genera la URL de Sales Navigator lista para usar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">¿Qué estás buscando?</label>
            <Textarea
              placeholder={
                type === "company"
                  ? "Ej: empresas de manufactura o retail en Argentina y Uruguay, entre 200 y 2000 empleados"
                  : "Ej: gerentes de RRHH o directores de personas en empresas de servicios de 500 a 5000 empleados en LATAM"
              }
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate()
              }}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">Cmd/Ctrl+Enter para generar</p>
          </div>

          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={isPending || !description.trim()}
          >
            {isPending ? (
              <><Loader2 className="mr-2 size-4 animate-spin" />Generando…</>
            ) : (
              <><Sparkles className="mr-2 size-4" />Generar URL</>
            )}
          </Button>

          {result && (
            <div className="space-y-2">
              {result.error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {result.error}
                </p>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">URL generada</label>
                  <div className="relative rounded-lg border bg-muted/40 p-3">
                    <p className="break-all pr-16 font-mono text-xs text-muted-foreground leading-relaxed">
                      {result.url}
                    </p>
                    <div className="absolute right-2 top-2 flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={handleCopy}
                        title="Copiar URL"
                      >
                        {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => window.open(result.url, "_blank")}
                        title="Abrir en Sales Navigator"
                      >
                        <ExternalLink className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Revisá los filtros en Sales Navigator antes de usar la URL. Esta es una sugerencia — podés ajustarla en Settings.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
