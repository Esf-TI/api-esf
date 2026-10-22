const prisma = require("./prismaClient")

/**
 * Historico de alteracoes (quem fez o que, quando, antes e depois).
 *
 * Gravar o historico nunca pode derrubar a acao do usuario: `registrar` roda
 * fora do caminho da resposta e engole erros (mesmo contrato de `logAdminAction`).
 */

const CAMPOS_SECRETOS = /senha|password|token|hash/i

/** Copia rasa-profunda sem campos secretos e sem valores gigantes (ex.: base64). */
function limpar(valor, profundidade = 0) {
  if (valor === undefined || valor === null) return valor ?? null
  if (valor instanceof Date) return valor.toISOString()
  if (typeof valor === "string") return valor.length > 2000 ? `${valor.slice(0, 2000)}…` : valor
  if (typeof valor !== "object") return valor
  if (profundidade > 4) return null
  if (Array.isArray(valor)) return valor.slice(0, 50).map((v) => limpar(v, profundidade + 1))

  const saida = {}
  for (const [chave, v] of Object.entries(valor)) {
    if (CAMPOS_SECRETOS.test(chave)) continue
    saida[chave] = limpar(v, profundidade + 1)
  }
  return saida
}

/** Quem esta agindo, a partir do que os middlewares de autenticacao deixaram em `req`. */
function atorDe(req) {
  if (req?.admin) {
    return { tipo: "admin", id: req.admin.id ?? null, nome: req.admin.nome ?? null, papel: req.admin.role ?? null }
  }
  if (req?.membro) {
    return { tipo: "membro", id: req.membro.id ?? null, nome: req.membro.nome ?? null, papel: req.membro.papel ?? null }
  }
  if (req?.nucleo) {
    return { tipo: "nucleo", id: req.nucleo.id ?? null, nome: req.nucleo.nome ?? null, papel: "nucleo" }
  }
  return { tipo: "sistema", id: null, nome: null, papel: null }
}

/**
 * @param {object} req  requisicao (de onde saem ator, IP e user agent)
 * @param {object} p
 * @param {string} p.acao        ex.: "projeto.fase_alterada"
 * @param {string} p.entidade    ex.: "projeto", "tarefa", "membro"
 * @param {number} [p.entidadeId]
 * @param {number} [p.nucleoId]  nucleo afetado (permite o nucleo ver o proprio historico)
 * @param {object} [p.antes]     estado anterior (em exclusao, o registro inteiro)
 * @param {object} [p.depois]    estado novo
 */
function registrar(req, { acao, entidade, entidadeId = null, nucleoId = null, antes = null, depois = null }) {
  const ator = atorDe(req)
  const ip = String(req?.headers?.["x-forwarded-for"] || req?.ip || "").split(",")[0].trim() || null

  return prisma.auditoriaLog
    .create({
      data: {
        ator_tipo: ator.tipo,
        ator_id: ator.id,
        ator_nome: ator.nome,
        ator_papel: ator.papel,
        nucleo_id: nucleoId,
        acao,
        entidade,
        entidade_id: entidadeId,
        antes: limpar(antes) ?? undefined,
        depois: limpar(depois) ?? undefined,
        ip: ip ? ip.slice(0, 64) : null,
        user_agent: req?.headers?.["user-agent"] ? String(req.headers["user-agent"]).slice(0, 255) : null,
      },
    })
    .catch((error) => console.error("[auditoria] Falha ao registrar:", error.message))
}

/** Campos que mudaram entre dois objetos: devolve { antes, depois } so com o que difere. */
function diferenca(antes, depois) {
  const a = {}
  const d = {}
  for (const chave of Object.keys(depois || {})) {
    if (chave === "updated_at") continue
    const x = antes?.[chave]
    const y = depois[chave]
    if (JSON.stringify(x) !== JSON.stringify(y)) {
      a[chave] = x ?? null
      d[chave] = y ?? null
    }
  }
  return { antes: a, depois: d }
}

module.exports = { registrar, diferenca, atorDe }
