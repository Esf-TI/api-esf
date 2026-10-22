const prisma = require("../lib/prismaClient")
const { SUPERADMIN } = require("../lib/adminRoles")
const { registrar, diferenca } = require("../lib/auditoria")

const COLUNAS = ["a_fazer", "fazendo", "feito"]
const FASES = ["planejamento", "execucao", "concluido", "pausado"]

const SELECT = {
  id: true,
  titulo: true,
  descricao: true,
  coluna: true,
  ordem: true,
  responsavel_nome: true,
  prazo: true,
  nucleo_id: true,
  autor_tipo: true,
  autor_id: true,
  autor_nome: true,
  created_at: true,
}

const dataOuNull = (valor) => {
  if (!valor) return null
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d
}

function autorDe(req) {
  if (req.membro) return { tipo: "membro", id: req.membro.id, nome: req.membro.nome || null }
  if (req.nucleo) return { tipo: "nucleo", id: req.nucleo.id, nome: req.nucleo.nome || null }
  return { tipo: "admin", id: req.admin.id, nome: req.admin.nome || null }
}

/** Gestão nacional modera qualquer card; os demais mexem só nos que criaram. */
const ehModerador = (req) =>
  Boolean(req.admin && (req.admin.role === SUPERADMIN || req.admin.role === "coordenador_nacional"))

const ehAutor = (req, card) => {
  const a = autorDe(req)
  return card.autor_tipo === a.tipo && card.autor_id === a.id
}

/** Marca no card se o usuário logado pode editá-lo ou excluí-lo (a tela esconde os botões). */
const comPermissao = (req, card) => ({ ...card, pode_editar: ehModerador(req) || ehAutor(req, card) })

const KanbanNacionalController = {
  /** GET /kanban-nacional — qualquer perfil logado vê o quadro nacional. */
  async listar(req, res) {
    try {
      const cards = await prisma.cardNacional.findMany({
        orderBy: [{ coluna: "asc" }, { ordem: "asc" }, { id: "asc" }],
        select: SELECT,
      })
      return res.json({ success: true, data: cards.map((c) => comPermissao(req, c)), total: cards.length })
    } catch (error) {
      console.error("Erro ao listar kanban nacional:", error)
      return res.status(500).json({ success: false, message: "Erro ao listar o quadro nacional" })
    }
  },

  /** POST /kanban-nacional — todos os perfis criam cards. */
  async criar(req, res) {
    const { titulo, descricao, coluna, responsavelNome, prazo } = req.body || {}
    if (!titulo || !String(titulo).trim()) {
      return res.status(400).json({ success: false, message: "O título do card é obrigatório" })
    }
    if (coluna && !COLUNAS.includes(coluna)) {
      return res.status(400).json({ success: false, message: `Coluna deve ser uma de: ${COLUNAS.join(", ")}` })
    }

    try {
      const colunaFinal = coluna || "a_fazer"
      const ultima = await prisma.cardNacional.findFirst({
        where: { coluna: colunaFinal },
        orderBy: { ordem: "desc" },
        select: { ordem: true },
      })
      const autor = autorDe(req)

      const card = await prisma.cardNacional.create({
        data: {
          titulo: String(titulo).trim().slice(0, 255),
          descricao: descricao ? String(descricao).trim() : null,
          coluna: colunaFinal,
          ordem: (ultima?.ordem ?? -1) + 1,
          responsavel_nome: responsavelNome ? String(responsavelNome).trim().slice(0, 255) : null,
          prazo: dataOuNull(prazo),
          nucleo_id: req.nucleo?.id ?? req.membro?.nucleoId ?? null,
          autor_tipo: autor.tipo,
          autor_id: autor.id,
          autor_nome: autor.nome,
        },
        select: SELECT,
      })

      registrar(req, { acao: "card_nacional.criado", entidade: "card_nacional", entidadeId: card.id, nucleoId: card.nucleo_id, depois: card })
      return res.status(201).json({ success: true, message: "Card criado", data: comPermissao(req, card) })
    } catch (error) {
      console.error("Erro ao criar card nacional:", error)
      return res.status(500).json({ success: false, message: "Erro ao criar card" })
    }
  },

  /** PATCH /kanban-nacional/:id — mover é livre; editar exige autoria ou gestão nacional. */
  async atualizar(req, res) {
    const id = Number(req.params.id)
    const { titulo, descricao, coluna, ordem, responsavelNome, prazo } = req.body || {}

    if (coluna && !COLUNAS.includes(coluna)) {
      return res.status(400).json({ success: false, message: `Coluna deve ser uma de: ${COLUNAS.join(", ")}` })
    }

    try {
      const atual = await prisma.cardNacional.findUnique({ where: { id } })
      if (!atual) return res.status(404).json({ success: false, message: "Card não encontrado" })

      const soMovimento = titulo === undefined && descricao === undefined && responsavelNome === undefined && prazo === undefined
      if (!soMovimento && !ehModerador(req) && !ehAutor(req, atual)) {
        return res.status(403).json({
          success: false,
          message: "Só quem criou o card ou a gestão nacional podem editá-lo",
          code: "PAPEL_INSUFICIENTE",
        })
      }

      const data = {}
      if (titulo !== undefined) {
        if (!String(titulo).trim()) return res.status(400).json({ success: false, message: "O título não pode ficar vazio" })
        data.titulo = String(titulo).trim().slice(0, 255)
      }
      if (descricao !== undefined) data.descricao = descricao ? String(descricao).trim() : null
      if (coluna !== undefined) data.coluna = coluna
      if (ordem !== undefined && Number.isFinite(Number(ordem))) data.ordem = Number(ordem)
      if (responsavelNome !== undefined) {
        data.responsavel_nome = responsavelNome ? String(responsavelNome).trim().slice(0, 255) : null
      }
      if (prazo !== undefined) data.prazo = dataOuNull(prazo)

      const card = await prisma.cardNacional.update({ where: { id }, data, select: SELECT })

      registrar(req, {
        acao: coluna !== undefined && coluna !== atual.coluna ? "card_nacional.movido" : "card_nacional.editado",
        entidade: "card_nacional",
        entidadeId: id,
        nucleoId: atual.nucleo_id,
        ...diferenca(atual, data),
      })
      return res.json({ success: true, message: "Card atualizado", data: comPermissao(req, card) })
    } catch (error) {
      console.error("Erro ao atualizar card nacional:", error)
      return res.status(500).json({ success: false, message: "Erro ao atualizar card" })
    }
  },

  /** DELETE /kanban-nacional/:id */
  async excluir(req, res) {
    const id = Number(req.params.id)
    try {
      const atual = await prisma.cardNacional.findUnique({ where: { id } })
      if (!atual) return res.status(404).json({ success: false, message: "Card não encontrado" })
      if (!ehModerador(req) && !ehAutor(req, atual)) {
        return res.status(403).json({
          success: false,
          message: "Só quem criou o card ou a gestão nacional podem excluí-lo",
          code: "PAPEL_INSUFICIENTE",
        })
      }

      await prisma.cardNacional.delete({ where: { id } })
      registrar(req, { acao: "card_nacional.excluido", entidade: "card_nacional", entidadeId: id, nucleoId: atual.nucleo_id, antes: atual })
      return res.json({ success: true, message: "Card excluído" })
    } catch (error) {
      console.error("Erro ao excluir card nacional:", error)
      return res.status(500).json({ success: false, message: "Erro ao excluir card" })
    }
  },

  /**
   * GET /kanban-nacional/projetos?nucleoId= — cards de PROJETO de todos os
   * núcleos, por fase. Atividades internas ficam de fora por construção (são
   * outra tabela). Só gestão nacional.
   */
  async projetosDosNucleos(req, res) {
    if (!ehModerador(req)) {
      return res.status(403).json({ success: false, message: "Seu usuário não tem permissão para esta área" })
    }

    try {
      const nucleoId = Number(req.query.nucleoId)
      const where = Number.isFinite(nucleoId) && req.query.nucleoId ? { NucleoResponsavel: nucleoId } : {}

      const [projetos, nucleos] = await Promise.all([
        prisma.projeto.findMany({
          where,
          orderBy: { id: "desc" },
          select: {
            id: true,
            Nome: true,
            Area: true,
            Cidade: true,
            PessoasImpactadas: true,
            fase: true,
            fotoCapa: true,
            NucleoResponsavel: true,
            nucleo: { select: { id: true, Nome: true, Cidade: true, Estado: true } },
          },
        }),
        prisma.nucleo.findMany({
          where: { status: "approved" },
          orderBy: { Nome: "asc" },
          select: { id: true, Nome: true, Cidade: true, Estado: true },
        }),
      ])

      // Projeto sem núcleo (dado órfão) cai numa fase válida e mostra "Sem núcleo".
      const cards = projetos.map((p) => ({ ...p, fase: FASES.includes(p.fase) ? p.fase : "planejamento" }))
      return res.json({ success: true, data: cards, nucleos, total: cards.length })
    } catch (error) {
      console.error("Erro ao listar projetos dos núcleos:", error)
      return res.status(500).json({ success: false, message: "Erro ao listar os projetos" })
    }
  },
}

module.exports = KanbanNacionalController
