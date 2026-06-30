export function calculateOsScore(jobTitle: string | null | undefined): number {
  if (!jobTitle) return 0

  const t = jobTitle
    .toLowerCase()
    .replace(/[áàäâã]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöôõ]/g, "o")
    .replace(/[úùüû]/g, "u")
    .replace(/ñ/g, "n")

  const isHR = /\b(hr|human\s+resources?|recursos\s+humanos|capital\s+humano|people|talent(?:o)?|cultura|rrhh|hrbp|gente|hris|workforce|organizational|organizacional|personas|recruiting|recruitment|reclutamiento)\b/.test(t)

  const isDirectorPlus = /\b(director|vp|vice\s+president|chief|ceo|coo|cto|chro|cpo|head|managing\s+director|executive\s+director|country\s+manager|gerente\s+general|presidente|fundador|founder|owner|socio)\b/.test(t)

  const isManager = /\b(manager|gerente|lider(?:esa)?|lead\b|jefe|jefa|business\s+partner|hrbp|responsable|encargado|encargada)\b/.test(t)

  const isAnalystOrIc = /\b(analyst|analista|specialist|especialista|coordinator|coordinador|coordinadora|assistant|asistente|generalist|generalista|recruiter|reclutador|senior|sr\b)\b/.test(t)

  if (isHR) {
    if (isDirectorPlus) return 10
    if (isManager) return 7
    if (isAnalystOrIc) return 4
    return 3
  }

  if (isDirectorPlus) return 3
  if (isManager) return 1
  return 0
}
