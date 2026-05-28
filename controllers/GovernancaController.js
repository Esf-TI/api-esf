const prisma = require("../lib/prismaClient")
const supabase = require("../lib/supabaseClient")
const { uploadPublicBuffer } = require("../lib/storageService")

const BUCKET = "site-assets"
const FOLDER = "governanca"

const GovernancaController = {
  async listar(req, res) {
    try {
      const membros = await prisma.governancaMembro.findMany({
        where: { ativo: true },
        orderBy: [{ conselho: "asc" }, { ordem: "asc" }, { nome: "asc" }],
      })
      res.json({ success: true, data: membros })
    } catch (error) {
      console.error("Erro ao listar membros:", error)
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
      console.error("Erro ao listar membros:", error)
      res.status(500).json({ success: false, message: "Erro ao listar membros" })
    }
  },

  async criar(req, res) {
    try {
      const { nome, cargo, conselho, nucleo, ordem, ativo } = req.body

      if (!nome || !cargo || !conselho) {
        return res.status(400).json({ success: false, message: "Nome, cargo e conselho são obrigatórios" })
      }

      let foto_url = null

      if (req.file) {
        const { publicUrl } = await uploadPublicBuffer({
          bucket: BUCKET,
          folder: FOLDER,
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
          foto_url,
          ordem: parseInt(ordem) || 0,
          ativo: ativo !== "false" && ativo !== false,
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

      const existente = await prisma.governancaMembro.findUnique({ where: { id: parseInt(id) } })
      if (!existente) {
        return res.status(404).json({ success: false, message: "Membro não encontrado" })
      }

      const dados = {}
      if (nome !== undefined) dados.nome = nome.trim()
      if (cargo !== undefined) dados.cargo = cargo.trim()
      if (conselho !== undefined) dados.conselho = conselho.trim()
      if (nucleo !== undefined) dados.nucleo = nucleo?.trim() || null
      if (ordem !== undefined) dados.ordem = parseInt(ordem) || 0
      if (ativo !== undefined) dados.ativo = ativo !== "false" && ativo !== false

      if (req.file) {
        // Remove foto antiga se existir
        if (existente.foto_url) {
          try {
            const match = existente.foto_url.match(/\/storage\/v1\/object\/public\/site-assets\/(.+)/)
            if (match) await supabase.storage.from(BUCKET).remove([match[1]])
          } catch (e) {
            console.warn("Não foi possível remover foto antiga:", e.message)
          }
        }
        const { publicUrl } = await uploadPublicBuffer({
          bucket: BUCKET,
          folder: FOLDER,
          file: req.file,
        })
        dados.foto_url = publicUrl
      }

      const membro = await prisma.governancaMembro.update({
        where: { id: parseInt(id) },
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
      const existente = await prisma.governancaMembro.findUnique({ where: { id: parseInt(id) } })
      if (!existente) {
        return res.status(404).json({ success: false, message: "Membro não encontrado" })
      }

      // Remove foto do storage
      if (existente.foto_url) {
        try {
          const match = existente.foto_url.match(/\/storage\/v1\/object\/public\/site-assets\/(.+)/)
          if (match) await supabase.storage.from(BUCKET).remove([match[1]])
        } catch (e) {
          console.warn("Não foi possível remover foto:", e.message)
        }
      }

      await prisma.governancaMembro.delete({ where: { id: parseInt(id) } })
      res.json({ success: true, message: "Membro excluído com sucesso" })
    } catch (error) {
      console.error("Erro ao deletar membro:", error)
      res.status(500).json({ success: false, message: "Erro ao deletar membro" })
    }
  },
}

module.exports = GovernancaController
