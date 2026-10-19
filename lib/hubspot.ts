// HubSpot API client (Service Key auth)

const BASE = "https://api.hubapi.com"

function hs_headers() {
  return {
    Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}`,
    "Content-Type": "application/json",
  }
}

export type HubspotDeal = {
  id: string
  dealname: string | null
  dealstage: string | null // internal stage ID
  associatedContacts: string[] // contact IDs
  associatedCompanies: string[] // company IDs
}

export type HubspotCompany = {
  id: string
  name: string | null
  domain: string | null
}

export type HubspotPipelineStage = {
  id: string
  label: string
}

// ── Pipelines ────────────────────────────────────────────────────────────────

export async function getDealPipelineStages(): Promise<HubspotPipelineStage[]> {
  const res = await fetch(`${BASE}/crm/v3/pipelines/deals`, {
    headers: hs_headers(),
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HubSpot pipelines ${res.status}: ${body.slice(0, 200)}`)
  }
  const json = await res.json()
  const stages: HubspotPipelineStage[] = []
  for (const pipeline of json.results ?? []) {
    for (const stage of pipeline.stages ?? []) {
      stages.push({ id: stage.id, label: stage.label })
    }
  }
  return stages
}

// ── Deals ────────────────────────────────────────────────────────────────────

export async function getAllDeals(): Promise<HubspotDeal[]> {
  const deals: HubspotDeal[] = []
  let after: string | undefined

  do {
    const params = new URLSearchParams({
      limit: "100",
      properties: "dealname,dealstage",
      associations: "contacts,companies",
    })
    if (after) params.set("after", after)

    const res = await fetch(`${BASE}/crm/v3/objects/deals?${params}`, {
      headers: hs_headers(),
      cache: "no-store",
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`HubSpot deals ${res.status}: ${body.slice(0, 200)}`)
    }
    const json = await res.json()

    for (const deal of json.results ?? []) {
      const contactIds = (
        deal.associations?.contacts?.results ?? []
      ).map((c: { id: string }) => c.id)
      const companyIds = (
        deal.associations?.companies?.results ?? []
      ).map((c: { id: string }) => c.id)
      deals.push({
        id: deal.id,
        dealname: deal.properties?.dealname ?? null,
        dealstage: deal.properties?.dealstage ?? null,
        associatedContacts: contactIds,
        associatedCompanies: companyIds,
      })
    }

    after = json.paging?.next?.after
  } while (after)

  return deals
}

// ── Companies ────────────────────────────────────────────────────────────────

/** Returns map companyId → { name, domain } for the given company IDs */
export async function getCompanyInfo(
  companyIds: string[]
): Promise<Map<string, HubspotCompany>> {
  const map = new Map<string, HubspotCompany>()
  if (companyIds.length === 0) return map

  for (let i = 0; i < companyIds.length; i += 100) {
    const batch = companyIds.slice(i, i + 100)
    const res = await fetch(`${BASE}/crm/v3/objects/companies/batch/read`, {
      method: "POST",
      headers: hs_headers(),
      body: JSON.stringify({
        inputs: batch.map((id) => ({ id })),
        properties: ["name", "domain"],
      }),
      cache: "no-store",
    })
    if (!res.ok) continue
    const json = await res.json()
    for (const company of json.results ?? []) {
      map.set(company.id, {
        id: company.id,
        name: company.properties?.name ?? null,
        domain: company.properties?.domain ?? null,
      })
    }
  }

  return map
}

// ── Sequences ────────────────────────────────────────────────────────────────

export type HubspotSequence = { id: string; name: string }

export type HubspotSequenceStep = {
  order: number
  type: string
  delayDays: number
}


export async function getSequenceWithSteps(sequenceId: string, userId: string): Promise<{
  id: string
  name: string
  steps: HubspotSequenceStep[]
}> {
  const params = new URLSearchParams({ userId })
  const res = await fetch(`${BASE}/automation/v4/sequences/${sequenceId}?${params}`, {
    headers: hs_headers(),
    cache: "no-store",
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`HubSpot sequence details ${res.status}: ${txt.slice(0, 300)}`)
  }
  const json = await res.json()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawSteps: any[] = json.sequenceSteps ?? json.steps ?? json.actions ?? []

  const steps: HubspotSequenceStep[] = []

  for (const raw of rawSteps) {
    const type: string = raw.actionType ?? raw.action ?? raw.type ?? raw.stepType ?? "UNKNOWN"
    const delayMs: number = raw.delayMillis ?? raw.delayMs ?? 0
    const delayDays = delayMs > 0 ? Math.round(delayMs / 86400000) : (raw.delayDays ?? raw.delay ?? raw.waitDays ?? 0)
    steps.push({ order: raw.stepOrder ?? raw.order ?? steps.length, type, delayDays })
  }

  return { id: json.id ?? sequenceId, name: json.name ?? json.sequenceName ?? sequenceId, steps }
}

export async function getSequences(userId: string): Promise<HubspotSequence[]> {
  const sequences: HubspotSequence[] = []
  let offset = 0
  const limit = 100
  do {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset), userId })
    const res = await fetch(`${BASE}/automation/v4/sequences?${params}`, {
      headers: hs_headers(),
      cache: "no-store",
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`HubSpot sequences ${res.status}: ${body.slice(0, 300)}`)
    }
    const json = await res.json()
    const results: { id: string; name?: string; sequenceName?: string }[] = json.results ?? json.sequences ?? json.objects ?? []
    for (const s of results) {
      const name = s.name ?? s.sequenceName ?? ""
      if (name) sequences.push({ id: String(s.id), name })
    }
    if (results.length < limit) break
    offset += limit
  } while (true)
  return sequences
}

export async function getAllSequences(): Promise<HubspotSequence[]> {
  const owners = await getOwners()
  const map = new Map<string, HubspotSequence>()
  await Promise.all(owners.map(async (owner) => {
    try {
      const seqs = await getSequences(owner.userId)
      for (const s of seqs) map.set(s.id, s)
    } catch {
      // owner may not have sequences
    }
  }))
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export type HubspotOwner = { id: string; userId: string; email: string; name: string }

export async function getOwners(): Promise<HubspotOwner[]> {
  const res = await fetch(`${BASE}/crm/v3/owners?limit=100`, {
    headers: hs_headers(),
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HubSpot owners ${res.status}: ${body.slice(0, 300)}`)
  }
  const json = await res.json()
  return (json.results ?? []).map((o: { id: string; userId?: number; email: string; firstName?: string; lastName?: string }) => ({
    id: o.id,
    userId: o.userId ? String(o.userId) : o.id,
    email: o.email ?? "",
    name: [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email,
  }))
}

export async function findContactByEmail(email: string): Promise<string | null> {
  const res = await fetch(`${BASE}/crm/v3/objects/contacts/search`, {
    method: "POST",
    headers: hs_headers(),
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
      properties: ["email"],
      limit: 1,
    }),
    cache: "no-store",
  })
  if (!res.ok) return null
  const json = await res.json()
  return json.results?.[0]?.id ?? null
}

export async function createContact(props: {
  email: string
  firstName?: string
  lastName?: string
  company?: string
  jobtitle?: string
}): Promise<string> {
  const properties: Record<string, string> = { email: props.email }
  if (props.firstName) properties.firstname = props.firstName
  if (props.lastName) properties.lastname = props.lastName
  if (props.company) properties.company = props.company
  if (props.jobtitle) properties.jobtitle = props.jobtitle
  const res = await fetch(`${BASE}/crm/v3/objects/contacts`, {
    method: "POST",
    headers: hs_headers(),
    body: JSON.stringify({ properties }),
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HubSpot create contact ${res.status}: ${body.slice(0, 300)}`)
  }
  const json = await res.json()
  return json.id
}

export async function enrollInSequence(
  sequenceId: string,
  contactId: string,
  userId: string,
  senderEmail: string,
  stepOverrides?: Array<{ stepOrder: number; subject?: string; body?: string }>
): Promise<void> {
  const userIdNum = Number(userId)
  if (!userIdNum) throw new Error(`userId inválido para enrollment: "${userId}"`)
  const params = new URLSearchParams({ userId: String(userIdNum) })
  const payload: Record<string, unknown> = {
    sequenceId: Number(sequenceId),
    contactId,
    userId: userIdNum,
    senderEmail,
  }
  if (stepOverrides?.length) payload.steps = stepOverrides
  const res = await fetch(`${BASE}/automation/v4/sequences/enrollments?${params}`, {
    method: "POST",
    headers: hs_headers(),
    body: JSON.stringify(payload),
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HubSpot enroll ${res.status}: ${body.slice(0, 300)}`)
  }
}

// ── Contact Lists ─────────────────────────────────────────────────────────────

export type HubspotList = {
  listId: string
  name: string
  listType: "STATIC" | "DYNAMIC"
  size: number
}

export async function getContactLists(): Promise<HubspotList[]> {
  const lists: HubspotList[] = []
  let offset = 0
  const count = 250

  do {
    const params = new URLSearchParams({
      objectTypeId: "0-1",
      count: String(count),
      offset: String(offset),
    })
    const res = await fetch(`${BASE}/crm/v3/lists?${params}`, {
      headers: hs_headers(),
      cache: "no-store",
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`HubSpot lists ${res.status}: ${body.slice(0, 200)}`)
    }
    const json = await res.json()
    for (const l of json.lists ?? []) {
      lists.push({
        listId: String(l.listId ?? l.id),
        name: l.name ?? "",
        listType: l.listType ?? "STATIC",
        size: l.additionalProperties?.hs_list_size ?? l.memberCount ?? 0,
      })
    }
    if (!json.hasMore) break
    offset += count
  } while (true)

  return lists.sort((a, b) => a.name.localeCompare(b.name))
}

export type HubspotContactRow = {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  jobTitle: string | null
  company: string | null
  domain: string | null
  phone: string | null
  linkedinUrl: string | null
}

export async function getContactsFromList(listId: string): Promise<HubspotContactRow[]> {
  // Step 1: get member IDs (paginated)
  const memberIds: string[] = []
  let after: string | undefined

  do {
    const params = new URLSearchParams({ limit: "250" })
    if (after) params.set("after", after)
    const res = await fetch(`${BASE}/crm/v3/lists/${listId}/memberships/join-order?${params}`, {
      headers: hs_headers(),
      cache: "no-store",
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`HubSpot list members ${res.status}: ${body.slice(0, 200)}`)
    }
    const json = await res.json()
    for (const m of json.results ?? []) {
      memberIds.push(String(m.recordId))
    }
    after = json.paging?.next?.after
  } while (after)

  if (memberIds.length === 0) return []

  // Step 2: batch-read contact properties
  const contacts: HubspotContactRow[] = []
  const PROPS = ["firstname", "lastname", "email", "jobtitle", "company", "hs_email_domain", "phone", "linkedinbio"]

  for (let i = 0; i < memberIds.length; i += 100) {
    const batch = memberIds.slice(i, i + 100)
    const res = await fetch(`${BASE}/crm/v3/objects/contacts/batch/read`, {
      method: "POST",
      headers: hs_headers(),
      body: JSON.stringify({ inputs: batch.map((id) => ({ id })), properties: PROPS }),
      cache: "no-store",
    })
    if (!res.ok) continue
    const json = await res.json()
    for (const c of json.results ?? []) {
      const p = c.properties ?? {}
      const email: string | null = p.email ?? null
      const domain: string | null =
        p.hs_email_domain ?? (email ? email.split("@")[1] ?? null : null)
      contacts.push({
        id: c.id,
        firstName: p.firstname ?? null,
        lastName: p.lastname ?? null,
        email,
        jobTitle: p.jobtitle ?? null,
        company: p.company ?? null,
        domain,
        phone: p.phone ?? null,
        linkedinUrl: p.linkedinbio ?? null,
      })
    }
  }

  return contacts
}

// ── Contacts ─────────────────────────────────────────────────────────────────

/** Returns map contactId → email (lowercase) for the given contact IDs */
export async function getContactEmails(
  contactIds: string[]
): Promise<Map<string, string>> {
  const emailMap = new Map<string, string>()
  if (contactIds.length === 0) return emailMap

  // Batch read supports up to 100 per request
  for (let i = 0; i < contactIds.length; i += 100) {
    const batch = contactIds.slice(i, i + 100)
    const res = await fetch(`${BASE}/crm/v3/objects/contacts/batch/read`, {
      method: "POST",
      headers: hs_headers(),
      body: JSON.stringify({
        inputs: batch.map((id) => ({ id })),
        properties: ["email"],
      }),
      cache: "no-store",
    })
    if (!res.ok) continue
    const json = await res.json()
    for (const contact of json.results ?? []) {
      const email: string | null = contact.properties?.email ?? null
      if (email) emailMap.set(contact.id, email.toLowerCase())
    }
  }

  return emailMap
}
