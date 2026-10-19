"use client"

import { useState, useTransition } from "react"
import { Sparkles, AlertCircle, CheckCircle2, Building2, Globe, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { generateCompaniesWithClaude, type ClaudeCompany } from "./actions"

export function ClaudeSearchClient({
  campaignId,
  industry,
}: {
  campaignId: string
  industry: string
}) {
  const [prompt, setPrompt] = useState("")
  const [results, setResults] = useState<ClaudeCompany[]>([])
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleGenerate() {
    if (!prompt.trim()) return
    setError("")
    setResults([])
    startTransition(async () => {
      try {
        const companies = await generateCompaniesWithClaude(campaignId, prompt, industry)
        setResults(companies)
        setDone(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado")
      }
    })
  }

  if (done && results.length > 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-4">
          <CheckCircle2 className="size-5 text-green-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm text-green-800 dark:text-green-300">
              {results.length} empresas agregadas a la campaña
            </p>
            <p className="text-xs text-green-700/70 dark:text-green-400/60 mt-0.5">
              Ahora podés ir a People Search para buscar contactos dentro de estas empresas.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {results.map((c, i) => (
            <div key={i} className="flex items-start gap-3 rounded-md border p-3">
              <Building2 className="size-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{c.company_name}</span>
                  {c.domain && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Globe className="size-3" />{c.domain}
                    </span>
                  )}
                  {c.headcount_range && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="size-3" />{c.headcount_range}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{c.why}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          className="text-xs text-muted-foreground underline"
          onClick={() => { setDone(false); setResults([]); setPrompt("") }}
        >
          Hacer otra búsqueda
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="size-4 text-orange-500" />
          <h2 className="text-lg font-semibold">Buscar con Claude</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Describí el tipo de empresa que querés prospectar. Claude va a generar una lista de empresas reales que matchean el perfil.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Descripción del ICP</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={`Ej: Empresas de retail con más de 200 empleados en Argentina que venden online y tienen tienda física. Buscamos hablar con el Director de Operaciones o Gerente de Tecnología.`}
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Industria de la campaña: <span className="font-medium">{industry}</span>
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <Button
        onClick={handleGenerate}
        disabled={isPending || !prompt.trim()}
        className="gap-2"
      >
        <Sparkles className="size-4" />
        {isPending ? "Claude está buscando..." : "Generar empresas"}
      </Button>

      {isPending && (
        <p className="text-xs text-muted-foreground animate-pulse">
          Esto puede tardar unos segundos…
        </p>
      )}
    </div>
  )
}
