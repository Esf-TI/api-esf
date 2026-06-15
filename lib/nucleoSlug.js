const prisma = require("./prismaClient")

/**
 * Campos seguros para exposição PÚBLICA (anônima). Allow-list explícita:
 * nunca inclui `Senha`, `Email`, `Token` nem campos internos de moderação.
 * Use sempre via `select` para evitar vazar segredos ao espalhar o registro.
 */
const NUCLEO_PUBLIC_SELECT = {
  id: true,
  Nome: true,
  Cidade: true,
  Estado: true,
  subdominio: true,
  Descricao: true,
  DataFundacao: true,
  fotoCapa: true,
  foto1: true,
  foto2: true,
  foto3: true,
  linkDoacao: true,
  linkSite: true,
  linkLinkedin: true,
  linkFacebook: true,
  linkInstagram: true,
  logoUrl: true,
  corPrimaria: true,
  Endereco: true,
  status: true,
}

/**
 * Campos para contextos AUTENTICADOS de admin: tudo do público + dados de
 * contato/moderação. NUNCA inclui `Senha` (hash bcrypt) nem `Token`.
 */
const NUCLEO_ADMIN_SELECT = {
  ...NUCLEO_PUBLIC_SELECT,
  Email: true,
  rejection_reason: true,
  approved_by: true,
  approved_at: true,
  created_at: true,
  updated_at: true,
}

function slugify(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Gera slug público do núcleo (ex.: florianopolis-sc).
 * Usa subdominio se existir; senão Nome + Cidade + Estado.
 */
function buildNucleoSlug(nucleo) {
  if (nucleo?.subdominio) return String(nucleo.subdominio).toLowerCase()
  const nome = String(nucleo?.Nome || "")
    .replace(/^esf\s+/i, "")
    .replace(/^n[uú]cleo\s+/i, "")
    .trim()
  const parts = [nome, nucleo?.Cidade, nucleo?.Estado].filter(Boolean)
  const base = slugify(parts.join(" "))
  if (base) return base
  const id = nucleo?.id ?? nucleo?.ID
  return id != null ? `nucleo-${id}` : "nucleo"
}

function assignSlugsToList(nucleos) {
  const used = new Map()
  return nucleos.map((n) => {
    let slug = buildNucleoSlug(n)
    if (used.has(slug)) {
      const id = n.id ?? n.ID
      slug = `${slug}-${id}`
    }
    used.set(slug, true)
    return { ...n, slug }
  })
}

function parseNucleoRouteParam(param) {
  if (param == null || param === "") return { slug: null, id: null }
  const raw = String(param).trim()
  if (/^\d+$/.test(raw)) return { slug: null, id: raw }
  const suffix = raw.match(/^(.+)-(\d+)$/)
  if (suffix) return { slug: suffix[1].toLowerCase(), id: suffix[2] }
  return { slug: raw.toLowerCase(), id: null }
}

/**
 * Resolve um núcleo a partir do parâmetro de rota (id, subdomínio ou slug).
 * Por padrão devolve apenas campos públicos (sem `Senha`/`Email`/`Token`).
 * Passe `{ includePrivate: true }` em contextos autenticados de admin para
 * incluir também os campos de contato/moderação (ainda sem a senha).
 */
async function resolveNucleoFromParam(param, { includePrivate = false } = {}) {
  if (param == null || param === "") return null
  const select = includePrivate ? NUCLEO_ADMIN_SELECT : NUCLEO_PUBLIC_SELECT
  const raw = String(param).trim()
  const { id: parsedId } = parseNucleoRouteParam(raw)

  if (parsedId) {
    return prisma.nucleo.findUnique({ where: { id: Number(parsedId) }, select })
  }

  if (/^\d+$/.test(raw)) {
    return prisma.nucleo.findUnique({ where: { id: Number(raw) }, select })
  }

  const slug = raw.toLowerCase()

  const bySub = await prisma.nucleo.findFirst({ where: { subdominio: slug }, select })
  if (bySub) return bySub

  const parts = slug.split("-").filter(Boolean)
  if (parts.length >= 2) {
    const candidates = await prisma.nucleo.findMany({
      where: {
        status: "approved",
        OR: [
          { Cidade: { contains: parts[0], mode: "insensitive" } },
          { Nome: { contains: parts[0], mode: "insensitive" } },
        ],
      },
      take: 50,
      select,
    })
    const match = assignSlugsToList(candidates).find((n) => n.slug === slug)
    if (match) return match
  }

  const approved = await prisma.nucleo.findMany({ where: { status: "approved" }, take: 200, select })
  const withSlugs = assignSlugsToList(approved)
  return withSlugs.find((n) => n.slug === slug) || null
}

async function resolveNucleoIdFromParam(param) {
  const nucleo = await resolveNucleoFromParam(param)
  return nucleo?.id ?? null
}

module.exports = {
  slugify,
  buildNucleoSlug,
  assignSlugsToList,
  parseNucleoRouteParam,
  resolveNucleoFromParam,
  resolveNucleoIdFromParam,
  NUCLEO_PUBLIC_SELECT,
  NUCLEO_ADMIN_SELECT,
}
