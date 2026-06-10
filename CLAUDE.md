# ProspectOS

SaaS de prospección B2B que reemplaza un flujo manual basado en Google Sheets (V14). Permite a un equipo de ventas ejecutar ciclos semanales de prospección: buscar empresas, scrapear personas, enriquecerlas con Apollo/Zerobounce y distribuirlas a secuencias de email/LinkedIn.

## El proceso que reemplaza (9 pasos originales)

1. **V14 (GSheets)** — Planning semanal por rep e industria
2. **Make** — Crea carpeta de prospección por cuenta
3. **Make + Apify** — Company Search: 50 empresas nuevas de Sales Navigator
4. **Make + Apify** — Trae resultados y los agrega al GSheet
5. **Claude + Sales Nav** — Crea lista de cuentas en Sales Navigator
6. **Make + Apify** — People Search: scrapea hasta 500 personas de esas empresas
7. **Make + Apify** — Trae personas y las agrega a "Bajada Apify → Clay"
8. **Clay** — Enriquece personas (email Apollo, validación ZB, score ICP, emails personalizados)
9. **Make** — Distribuye a Smartlead o HeyReach según condiciones

## Stack técnico

- **Frontend**: Next.js 16 (App Router) + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes
- **DB**: Supabase (PostgreSQL + realtime para polling de jobs)
- **Auth**: Clerk (multi-usuario, un login por rep de ventas)
- **Deploy**: Vercel (frontend) + Supabase cloud
- **Integraciones**: Apify, Apollo, Zerobounce, Smartlead, HeyReach

## Usuarios del sistema

Reps de ventas: Alu, Fede, Guido, Suva, Jess (cada uno tiene su login y ve sus campañas)

## Schema de la DB

Ver `supabase/migrations/001_initial_schema.sql`. Entidades principales:

- `campaigns` — ciclo semanal (semana, rep, industria, estado)
- `accounts` — empresas descubiertas (nombre, dominio, Sales Nav ID, estado)
- `prospects` — personas scraped y enriquecidas (email, score ICP, emails personalizados, estado)
- `search_jobs` — jobs de Apify (company_search | people_search, estado, run_id)
- `distribution_rules` — reglas configurables para Smartlead vs HeyReach

## Módulos de la UI

| Ruta | Módulo | Reemplaza |
|------|--------|-----------|
| `/dashboard` | Planning semanal + KPIs | Solapa Agenda del V14 |
| `/campaigns/[id]` | Detalle de campaña | — |
| `/company-search` | Generador URL Sales Nav + trigger Apify | Solapa Company Search + Make steps 3-4 |
| `/people-search` | Scraping de personas + progreso realtime | Steps 6-7 + Bajada Apify |
| `/enrichment` | Enriquecimiento Apollo + ZB + scoring | Clay step 8 |
| `/distribution` | Reglas + envío a Smartlead/HeyReach | Make step 9 |

## Lo que ya está hecho

- [x] Setup Next.js 16 + Tailwind + shadcn/ui
- [x] Dependencias instaladas: `@supabase/supabase-js`, `@supabase/ssr`, `@clerk/nextjs`, `lucide-react`
- [x] Componentes shadcn: card, table, badge, button, input, select, dialog, tabs, progress, sheet, sidebar
- [x] Schema SQL completo (`supabase/migrations/001_initial_schema.sql`)
- [x] Cliente Supabase (`lib/supabase.ts`)
- [x] Variables de entorno template (`.env.local`)
- [x] Estructura de carpetas creada

## Próximos pasos (Fase 1)

1. Crear cuenta en Supabase → copiar URL y keys en `.env.local`
2. Crear cuenta en Clerk → copiar keys en `.env.local`
3. Correr la migración SQL en Supabase
4. Crear middleware de Clerk (`middleware.ts`)
5. Crear layout principal con sidebar
6. Construir dashboard de planning semanal (CRUD de campañas, vista por rep)

## Clientes de integraciones a crear

```
lib/
  supabase.ts      hecho
  apify.ts         pendiente
  apollo.ts        pendiente
  zerobounce.ts    pendiente
  smartlead.ts     pendiente
  heyreach.ts      pendiente
```

## Industrias del ICP (datos del V14)

Retail & Comercio, Manufactura, Finance & Insurance, Agro & Energy, Construcción, BPO & Professional Services, Health & Entertainment, Consulting & Telco

## Scores ICP usados en Clay (referencia)

- Score 10: C-level / VP / Director + industria exacta
- Score 5: Manager / Jefe + industria relacionada
- Score 0: rol no relevante
- Categorías: Experience, Helpdesk, Onboarding, Communication, Generic
