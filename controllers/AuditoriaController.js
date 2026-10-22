const prisma = require("../lib/prismaClient")
const { SUPERADMIN } = require("../lib/adminRoles")

const LIMITE_MAXIMO = 100

/** Quem enxerga o historico geral: superadmin e Coordenador Nacional. */
function podeVerGeral(req) {
  return Boolean(req.admin && (req.admin.role === SUPERADMIN || req.admin.role === "coordenador_nacional"))
}

/** Quem enxerga o historico de um nucleo: a conta do Núcleo, Diretor e Coordenador dele, e a gestão nacional. */
function podeVerDoNucleo(req, nucleoId) {
  if (podeVerGeral(req)) return true
  if (req.nucleo) return req.nucleo.id === nucleoId
  if (req.membro) return req.membro.nucleoId === nucleoId && ["diretor", "coordenador"].includes(req.membro.papel)
  return false
}

function dataValida(valor, fimDoDia = false) {
  if (!valor) return null
  const d = new Date(`${String(valor).slice(0, 10)}T${fimDoDia ? "23:59:59.999" : "00:00:00.000"}`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Monta o `where` a partir dos filtros comuns às duas consultas. */
function montarFiltro(query) {
  const where = {}
  if (query.entidade) where.entidade = String(query.entidade)
  if (query.acao) where.acao = { startsWith: String(query.acao) }
  if (query.atorTipo) where.ator_tipo = String(query.atorTipo)
  if (query.atorId && Number.isFinite(Number(query.atorId))) where.ator_id = Number(query.atorId)

  const de = dataValida(query.de)
  const ate = dataValida(query.ate, true)
  if (de || ate) where.created_at = { ...(de && { gte: de }), ...(ate && { lte: ate }) }

  const busca = String(query.busca || "").trim()
  if (busca) where.ator_nome = { contains: busca, mode: "insensitive" }
  return where
}

async function listar(where, query, res) {
  const pagina = Math.max(1, Number.parseInt(query.page, 10) || 1)
  const limite = Math.min(LIMITE_MAXIMO, Math.max(1, Number.parseInt(query.limit, 10) || 25))

  const [total, registros] = await Promise.all([
    prisma.auditoriaLog.count({ where }),
    prisma.auditoriaLog.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (pagina - 1) * limite,
      take: limite,
    }),
  ])

  return res.json({
    success: true,
    data: registros,
    meta: { total, page: pagina, limit: limite, pages: Math.max(1, Math.ceil(total / limite)) },
  })
}

const AuditoriaController = {
  /** GET /auditoria — historico geral (filtro opcional por núcleo). */
  async geral(req, res) {
    if (!podeVerGeral(req)) {
      return res.status(403).json({ success: false, message: "Seu usuário não tem permissão para esta área" })
    }
    try {
      const where = montarFiltro(req.query)
      if (req.query.nucleoId && Number.isFinite(Number(req.query.nucleoId))) where.nucleo_id = Number(req.query.nucleoId)
      return await listar(where, req.query, res)
    } catch (error) {
      console.error("Erro ao listar auditoria:", error)
      return res.status(500).json({ success: false, message: "Erro ao listar o histórico" })
    }
  },

  /** GET /auditoria/nucleo/:id — historico do próprio núcleo. */
  async doNucleo(req, res) {
    const nucleoId = Number(req.params.id)
    if (!Number.isFinite(nucleoId)) return res.status(400).json({ success: false, message: "ID inválido" })
    if (!podeVerDoNucleo(req, nucleoId)) {
      return res.status(403).json({ success: false, message: "Você não pode ver o histórico deste núcleo" })
    }
    try {
      return await listar({ ...montarFiltro(req.query), nucleo_id: nucleoId }, req.query, res)
    } catch (error) {
      console.error("Erro ao listar auditoria do núcleo:", error)
      return res.status(500).json({ success: false, message: "Erro ao listar o histórico" })
    }
  },
}

module.exports = AuditoriaController
