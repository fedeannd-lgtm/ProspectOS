"use client"

import { useState, useTransition } from "react"
import { CheckCircle2, XCircle, Loader2, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { upsertRepCookie } from "./actions"

type RepConfig = {
  rep_name: string
  linkedin_cookie: string | null
  updated_at: string | null
}

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

export function SettingsClient({ configs }: { configs: RepConfig[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Cookies de LinkedIn Sales Navigator por SDR. Se usan para autenticar el scraping en Apify.
        </p>
      </div>

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
    </div>
  )
}
