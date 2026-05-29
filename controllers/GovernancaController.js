const prisma = require("../lib/prismaClient")
const supabase = require("../lib/supabaseClient")
const { uploadPublicBuffer } = require("../lib/storageService")

const BUCKET = "governanca"

function parseAtivo(value) {
  if (value === undefined || value === null || value === "") return undefined
  if (typeof value === "boolean") return value
  return String(value).toLowerCase() === "true"
}

function parseOrdem(value) {
  const n = parseInt(value, 10)
  return Number.isFinite(n) ? n : 0
}

async function removeFotoFromStorage(fotoUrl) {
  if (!fotoUrl) return
  try {
    const pathMatch = fotoUrl.match(/\/storage\/v1\/object\/public\/governanca\/(.+)/)
    if (pathMatch) {
      await supabase.storage.from(BUCKET).remove([pathMatch[1]])
    }
  } catch (e) {
    console.warn("Não foi possível remover foto:", e.message)
  }
}

const GovernancaController = {
  async listarPublico(req, res) {
    try {
      const membros = await prisma.governancaMembro.findMany({
        where: { ativo: true },
        orderBy: [{ conselho: "asc" }, { ordem: "asc" }, { nome: "asc" }],
      })
      res.json({ success: true, data: membros })
    } catch (error) {
      console.error("Erro ao listar governança:", error)
      res.status(500).json({ success: false, message: "Erro ao listar membros" })
    }
  },

  async listarTodos(req, res) {
    try {
      const membros = await prisma.governancaMembro.findMany({
        orderBy: [{ conselho: "asc" }, { ordem: "asc" }, { nome: "asc" }],
      })
      res.json({ success: true, data: membros })
    } catch (error) {
      console.error("Erro ao listar governança (admin):", error)
      res.status(500).json({ success: false, message: "Erro ao listar membros" })
    }
  },

  async criar(req, res) {
    try {
      const { nome, cargo, conselho, nucleo, ordem, ativo } = req.body

      if (!nome?.trim() || !cargo?.trim() || !conselho?.trim()) {
        return res.status(400).json({ success: false, message: "Nome, cargo e conselho são obrigatórios" })
      }

      let foto_url = null
      if (req.file) {
        const folder = conselho.toLowerCase().replace(/\s+/g, "-")
        const { publicUrl } = await uploadPublicBuffer({
          bucket: BUCKET,
          folder,
          file: req.file,
        })
        foto_url = publicUrl
      }

      const membro = await prisma.governancaMembro.create({
        data: {
          nome: nome.trim(),
          cargo: cargo.trim(),
          conselho: conselho.trim(),
          nucleo: nucleo?.trim() || null,
          ordem: parseOrdem(ordem),
          ativo: parseAtivo(ativo) ?? true,
          foto_url,
        },
      })

      res.status(201).json({ success: true, data: membro })
    } catch (error) {
      console.error("Erro ao criar membro:", error)
      res.status(500).json({ success: false, message: "Erro ao criar membro", error: error.message })
    }
  },

  async atualizar(req, res) {
    try {
      const { id } = req.params
      const { nome, cargo, conselho, nucleo, ordem, ativo } = req.body

      const existente = await prisma.governancaMembro.findUnique({
        where: { id: parseInt(id, 10) },
      })
      if (!existente) {
        return res.status(404).json({ success: false, message: "Membro não encontrado" })
      }

      const dados = {}
      if (nome) dados.nome = nome.trim()
      if (cargo) dados.cargo = cargo.trim()
      if (conselho) dados.conselho = conselho.trim()
      if (nucleo !== undefined) dados.nucleo = nucleo?.trim() || null
      if (ordem !== undefined) dados.ordem = parseOrdem(ordem)
      const ativoParsed = parseAtivo(ativo)
      if (ativoParsed !== undefined) dados.ativo = ativoParsed

      if (req.file) {
        await removeFotoFromStorage(existente.foto_url)
        const folder = (conselho || existente.conselho).toLowerCase().replace(/\s+/g, "-")
        const { publicUrl } = await uploadPublicBuffer({
          bucket: BUCKET,
          folder,
          file: req.file,
        })
        dados.foto_url = publicUrl
      }

      const membro = await prisma.governancaMembro.update({
        where: { id: parseInt(id, 10) },
        data: dados,
      })

      res.json({ success: true, data: membro })
    } catch (error) {
      console.error("Erro ao atualizar membro:", error)
      res.status(500).json({ success: false, message: "Erro ao atualizar membro", error: error.message })
    }
  },

  async deletar(req, res) {
    try {
      const { id } = req.params
      const existente = await prisma.governancaMembro.findUnique({
        where: { id: parseInt(id, 10) },
      })
      if (!existente) {
        return res.status(404).json({ success: false, message: "Membro não encontrado" })
      }

      await removeFotoFromStorage(existente.foto_url)
      await prisma.governancaMembro.delete({ where: { id: parseInt(id, 10) } })

      res.json({ success: true, message: "Membro excluído com sucesso" })
    } catch (error) {
      console.error("Erro ao excluir membro:", error)
      res.status(500).json({ success: false, message: "Erro ao excluir membro" })
    }
  },
}

module.exports = GovernancaController
