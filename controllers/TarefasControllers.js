const prisma = require("../lib/prismaClient")
require("dotenv").config()

/** Colunas do quadro interno do projeto. */
const COLUNAS = ["a_fazer", "fazendo", "feito"]

const TAREFA_SELECT = {
  id: true,
  projetoId: true,
  titulo: true,
  descricao: true,
  coluna: true,
  ordem: true,
  responsavelId: true,
  prazo: true,
  created_at: true,
  responsavel: { select: { id: true, nome: true } },
}

function dataOuNull(valor) {
  if (!valor) return null
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * O responsavel precisa ser membro do MESMO nucleo dono do projeto: sem esta
 * checagem daria para apontar alguem de outro nucleo passando o id na mao.
 */
async function responsavelValido(projetoId, responsavelId) {
  if (responsavelId == null) return true

  const [projeto, membro] = await Promise.all([
    prisma.projeto.findUnique({ where: { id: projetoId }, select: { NucleoResponsavel: true } }),
    prisma.nucleoMembro.findUnique({ where: { id: Number(responsavelId) }, select: { nucleoId: true } }),
  ])

  return Boolean(projeto && membro && projeto.NucleoResponsavel === membro.nucleoId)
}

/** GET /tarefas/projeto/:id */
const listarDoProjeto = async (req, res) => {
  const projetoId = Number(req.params.id)
  if (!Number.isFinite(projetoId)) {
    return res.status(400).json({ success: false, message: "ID de projeto inválido" })
  }

  try {
    const tarefas = await prisma.projetoTarefa.findMany({
      where: { projetoId },
      orderBy: [{ coluna: "asc" }, { ordem: "asc" }, { id: "asc" }],
      select: TAREFA_SELECT,
    })

    return res.json({ success: true, data: tarefas, total: tarefas.length })
  } catch (error) {
    console.error("Erro ao listar tarefas:", error)
    return res.status(500).json({ success: false, message: "Erro ao listar tarefas" })
  }
}

/** POST /tarefas/projeto/:id */
const criar = async (req, res) => {
  const projetoId = Number(req.params.id)
  const { titulo, descricao, coluna, responsavelId, prazo } = req.body || {}

  if (!Number.isFinite(projetoId)) {
    return res.status(400).json({ success: false, message: "ID de projeto inválido" })
  }
  if (!titulo || !String(titulo).trim()) {
    return res.status(400).json({ success: false, message: "O título da tarefa é obrigatório" })
  }
  if (coluna && !COLUNAS.includes(coluna)) {
    return res.status(400).json({ success: false, message: `Coluna deve ser uma de: ${COLUNAS.join(", ")}` })
  }
  if (responsavelId != null && !(await responsavelValido(projetoId, responsavelId))) {
    return res.status(400).json({ success: false, message: "O responsável precisa ser membro deste núcleo" })
  }

  try {
    const colunaFinal = coluna || "a_fazer"

    // Entra no fim da coluna: `ordem` maior que a ultima existente.
    const ultima = await prisma.projetoTarefa.findFirst({
      where: { projetoId, coluna: colunaFinal },
      orderBy: { ordem: "desc" },
      select: { ordem: true },
    })

    const tarefa = await prisma.projetoTarefa.create({
      data: {
        projetoId,
        titulo: String(titulo).trim(),
        descricao: descricao ? String(descricao).trim() : null,
        coluna: colunaFinal,
        ordem: (ultima?.ordem ?? -1) + 1,
        responsavelId: responsavelId != null ? Number(responsavelId) : null,
        prazo: dataOuNull(prazo),
      },
      select: TAREFA_SELECT,
    })

    return res.status(201).json({ success: true, message: "Tarefa criada", data: tarefa })
  } catch (error) {
    console.error("Erro ao criar tarefa:", error)
    return res.status(500).json({ success: false, message: "Erro ao criar tarefa" })
  }
}

/** PATCH /tarefas/:id — edicao e tambem o movimento no quadro. */
const atualizar = async (req, res) => {
  const id = Number(req.params.id)
  const { titulo, descricao, coluna, ordem, responsavelId, prazo } = req.body || {}

  if (coluna && !COLUNAS.includes(coluna)) {
    return res.status(400).json({ success: false, message: `Coluna deve ser uma de: ${COLUNAS.join(", ")}` })
  }

  try {
    const atual = await prisma.projetoTarefa.findUnique({ where: { id }, select: { projetoId: true } })
    if (!atual) return res.status(404).json({ success: false, message: "Tarefa não encontrada" })

    if (responsavelId != null && !(await responsavelValido(atual.projetoId, responsavelId))) {
      return res.status(400).json({ success: false, message: "O responsável precisa ser membro deste núcleo" })
    }

    const data = {}
    if (titulo !== undefined) data.titulo = String(titulo).trim()
    if (descricao !== undefined) data.descricao = descricao ? String(descricao).trim() : null
    if (coluna !== undefined) data.coluna = coluna
    if (ordem !== undefined && Number.isFinite(Number(ordem))) data.ordem = Number(ordem)
    if (responsavelId !== undefined) data.responsavelId = responsavelId == null ? null : Number(responsavelId)
    if (prazo !== undefined) data.prazo = dataOuNull(prazo)

    const tarefa = await prisma.projetoTarefa.update({ where: { id }, data, select: TAREFA_SELECT })

    return res.json({ success: true, message: "Tarefa atualizada", data: tarefa })
  } catch (error) {
    console.error("Erro ao atualizar tarefa:", error)
    return res.status(500).json({ success: false, message: "Erro ao atualizar tarefa" })
  }
}

/** DELETE /tarefas/:id */
const excluir = async (req, res) => {
  const id = Number(req.params.id)

  try {
    await prisma.projetoTarefa.delete({ where: { id } })
    return res.json({ success: true, message: "Tarefa excluída" })
  } catch (error) {
    if (error?.code === "P2025") {
      return res.status(404).json({ success: false, message: "Tarefa não encontrada" })
    }
    console.error("Erro ao excluir tarefa:", error)
    return res.status(500).json({ success: false, message: "Erro ao excluir tarefa" })
  }
}

module.exports = { listarDoProjeto, criar, atualizar, excluir, COLUNAS }
