const prisma = require("../lib/prismaClient")
const { SUPERADMIN } = require("../lib/adminRoles")
const { registrar, diferenca } = require("../lib/auditoria")

/** Colunas do quadro de atividades internas (as mesmas das tarefas de projeto). */
const COLUNAS = ["a_fazer", "fazendo", "feito"]

const SELECT = {
  id: true,
  nucleoId: true,
  titulo: true,
  descricao: true,
  coluna: true,
  ordem: true,
  responsavelId: true,
  prazo: true,
  autor_tipo: true,
  autor_id: true,
  autor_nome: true,
  created_at: true,
  responsavel: { select: { id: true, nome: true } },
}

const dataOuNull = (valor) => {
  if (!valor) return null
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Núcleo a que o ator pertence (conta do Núcleo ou membro). Superadmin não tem. */
const nucleoDoAtor = (req) => req.nucleo?.id ?? req.membro?.nucleoId ?? null

const ehSuperadmin = (req) => Boolean(req.admin && req.admin.role === SUPERADMIN)

/** Atividade interna é assunto do núcleo: só quem é dele (ou o superadmin) enxerga. */
const podeAcessarNucleo = (req, nucleoId) => ehSuperadmin(req) || nucleoDoAtor(req) === nucleoId

/** Gestores editam e apagam qualquer atividade; os demais, só as que criaram. */
const ehGestor = (req) =>
  ehSuperadmin(req) || Boolean(req.nucleo) || (req.membro && ["diretor", "coordenador"].includes(req.membro.papel))

function autorDe(req) {
  if (req.membro) return { tipo: "membro", id: req.membro.id, nome: req.membro.nome || null }
  if (req.nucleo) return { tipo: "nucleo", id: req.nucleo.id, nome: req.nucleo.nome || null }
  return { tipo: "admin", id: req.admin.id, nome: req.admin.nome || null }
}

const ehAutor = (req, atividade) => {
  const a = autorDe(req)
  return atividade.autor_tipo === a.tipo && atividade.autor_id === a.id
}

async function responsavelValido(nucleoId, responsavelId) {
  const membro = await prisma.nucleoMembro.findUnique({
    where: { id: Number(responsavelId) },
    select: { nucleoId: true, status: true },
  })
  return Boolean(membro && membro.nucleoId === nucleoId && membro.status === "ativo")
}

const AtividadesController = {
  /** GET /atividades/nucleo/:id */
  async listar(req, res) {
    const nucleoId = Number(req.params.id)
    if (!Number.isFinite(nucleoId)) return res.status(400).json({ success: false, message: "ID de núcleo inválido" })
    if (!podeAcessarNucleo(req, nucleoId)) {
      return res.status(403).json({ success: false, message: "As atividades internas são visíveis só para o próprio núcleo" })
    }

    try {
      const atividades = await prisma.nucleoAtividade.findMany({
        where: { nucleoId },
        orderBy: [{ coluna: "asc" }, { ordem: "asc" }, { id: "asc" }],
        select: SELECT,
      })
      return res.json({ success: true, data: atividades, total: atividades.length })
    } catch (error) {
      console.error("Erro ao listar atividades:", error)
      return res.status(500).json({ success: false, message: "Erro ao listar atividades" })
    }
  },

  /** POST /atividades/nucleo/:id — qualquer perfil do núcleo cria. */
  async criar(req, res) {
    const nucleoId = Number(req.params.id)
    const { titulo, descricao, coluna, responsavelId, prazo } = req.body || {}

    if (!Number.isFinite(nucleoId)) return res.status(400).json({ success: false, message: "ID de núcleo inválido" })
    if (!podeAcessarNucleo(req, nucleoId)) {
      return res.status(403).json({ success: false, message: "Você só pode criar atividades no seu núcleo" })
    }
    if (!titulo || !String(titulo).trim()) {
      return res.status(400).json({ success: false, message: "O título da atividade é obrigatório" })
    }
    if (coluna && !COLUNAS.includes(coluna)) {
      return res.status(400).json({ success: false, message: `Coluna deve ser uma de: ${COLUNAS.join(", ")}` })
    }
    if (responsavelId != null && !(await responsavelValido(nucleoId, responsavelId))) {
      return res.status(400).json({ success: false, message: "O responsável precisa ser membro ativo deste núcleo" })
    }

    try {
      const colunaFinal = coluna || "a_fazer"
      const ultima = await prisma.nucleoAtividade.findFirst({
        where: { nucleoId, coluna: colunaFinal },
        orderBy: { ordem: "desc" },
        select: { ordem: true },
      })
      const autor = autorDe(req)

      const atividade = await prisma.nucleoAtividade.create({
        data: {
          nucleoId,
          titulo: String(titulo).trim().slice(0, 255),
          descricao: descricao ? String(descricao).trim() : null,
          coluna: colunaFinal,
          ordem: (ultima?.ordem ?? -1) + 1,
          responsavelId: responsavelId != null ? Number(responsavelId) : null,
          prazo: dataOuNull(prazo),
          autor_tipo: autor.tipo,
          autor_id: autor.id,
          autor_nome: autor.nome,
        },
        select: SELECT,
      })

      registrar(req, { acao: "atividade.criada", entidade: "atividade", entidadeId: atividade.id, nucleoId, depois: atividade })
      return res.status(201).json({ success: true, message: "Atividade criada", data: atividade })
    } catch (error) {
      console.error("Erro ao criar atividade:", error)
      return res.status(500).json({ success: false, message: "Erro ao criar atividade" })
    }
  },

  /** PATCH /atividades/:id — mover é livre para o núcleo; editar exige autoria ou gestão. */
  async atualizar(req, res) {
    const id = Number(req.params.id)
    const { titulo, descricao, coluna, ordem, responsavelId, prazo } = req.body || {}

    if (coluna && !COLUNAS.includes(coluna)) {
      return res.status(400).json({ success: false, message: `Coluna deve ser uma de: ${COLUNAS.join(", ")}` })
    }

    try {
      const atual = await prisma.nucleoAtividade.findUnique({ where: { id } })
      if (!atual) return res.status(404).json({ success: false, message: "Atividade não encontrada" })
      if (!podeAcessarNucleo(req, atual.nucleoId)) {
        return res.status(403).json({ success: false, message: "Esta atividade pertence a outro núcleo" })
      }

      const soMovimento = titulo === undefined && descricao === undefined && responsavelId === undefined && prazo === undefined
      if (!soMovimento && !ehGestor(req) && !ehAutor(req, atual)) {
        return res.status(403).json({
          success: false,
          message: "Só quem criou a atividade, o Diretor ou o Coordenador podem editá-la",
          code: "PAPEL_INSUFICIENTE",
        })
      }
      if (responsavelId != null && !(await responsavelValido(atual.nucleoId, responsavelId))) {
        return res.status(400).json({ success: false, message: "O responsável precisa ser membro ativo deste núcleo" })
      }

      const data = {}
      if (titulo !== undefined) {
        if (!String(titulo).trim()) return res.status(400).json({ success: false, message: "O título não pode ficar vazio" })
        data.titulo = String(titulo).trim().slice(0, 255)
      }
      if (descricao !== undefined) data.descricao = descricao ? String(descricao).trim() : null
      if (coluna !== undefined) data.coluna = coluna
      if (ordem !== undefined && Number.isFinite(Number(ordem))) data.ordem = Number(ordem)
      if (responsavelId !== undefined) data.responsavelId = responsavelId == null ? null : Number(responsavelId)
      if (prazo !== undefined) data.prazo = dataOuNull(prazo)

      const atividade = await prisma.nucleoAtividade.update({ where: { id }, data, select: SELECT })

      registrar(req, {
        acao: coluna !== undefined && coluna !== atual.coluna ? "atividade.movida" : "atividade.editada",
        entidade: "atividade",
        entidadeId: id,
        nucleoId: atual.nucleoId,
        ...diferenca(atual, data),
      })
      return res.json({ success: true, message: "Atividade atualizada", data: atividade })
    } catch (error) {
      console.error("Erro ao atualizar atividade:", error)
      return res.status(500).json({ success: false, message: "Erro ao atualizar atividade" })
    }
  },

  /** DELETE /atividades/:id */
  async excluir(req, res) {
    const id = Number(req.params.id)
    try {
      const atual = await prisma.nucleoAtividade.findUnique({ where: { id } })
      if (!atual) return res.status(404).json({ success: false, message: "Atividade não encontrada" })
      if (!podeAcessarNucleo(req, atual.nucleoId)) {
        return res.status(403).json({ success: false, message: "Esta atividade pertence a outro núcleo" })
      }
      if (!ehGestor(req) && !ehAutor(req, atual)) {
        return res.status(403).json({
          success: false,
          message: "Só quem criou a atividade, o Diretor ou o Coordenador podem excluí-la",
          code: "PAPEL_INSUFICIENTE",
        })
      }

      await prisma.nucleoAtividade.delete({ where: { id } })
      registrar(req, { acao: "atividade.excluida", entidade: "atividade", entidadeId: id, nucleoId: atual.nucleoId, antes: atual })
      return res.json({ success: true, message: "Atividade excluída" })
    } catch (error) {
      console.error("Erro ao excluir atividade:", error)
      return res.status(500).json({ success: false, message: "Erro ao excluir atividade" })
    }
  },
}

module.exports = AtividadesController
