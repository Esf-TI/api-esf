const prisma = require("../lib/prismaClient")
const supabase = require("../lib/supabaseClient")
const { uploadPublicBuffer } = require("../lib/storageService")

const BUCKET = "transparencia"

const TransparenciaController = {
  async listar(req, res) {
    try {
      const { categoria } = req.query
      const where = categoria ? { categoria } : {}
      const documentos = await prisma.documentoTransparencia.findMany({
        where,
        orderBy: { created_at: "desc" },
        include: { creator: { select: { id: true, nome: true } } },
      })
      res.json({ success: true, data: documentos })
    } catch (error) {
      console.error("Erro ao listar documentos:", error)
      res.status(500).json({ success: false, message: "Erro ao listar documentos" })
    }
  },

  async buscarPorId(req, res) {
    try {
      const { id } = req.params
      const documento = await prisma.documentoTransparencia.findUnique({
        where: { id: parseInt(id) },
        include: { creator: { select: { id: true, nome: true } } },
      })
      if (!documento) {
        return res.status(404).json({ success: false, message: "Documento não encontrado" })
      }
      res.json({ success: true, data: documento })
    } catch (error) {
      console.error("Erro ao buscar documento:", error)
      res.status(500).json({ success: false, message: "Erro ao buscar documento" })
    }
  },

  async criar(req, res) {
    try {
      const { titulo, descricao, categoria } = req.body

      if (!titulo || !categoria) {
        return res.status(400).json({ success: false, message: "Título e categoria são obrigatórios" })
      }

      const arquivos = req.files || []
      if (arquivos.length === 0) {
        return res.status(400).json({ success: false, message: "Pelo menos um arquivo é obrigatório" })
      }

      const documentosCriados = []

      for (const file of arquivos) {
        const { objectPath, publicUrl } = await uploadPublicBuffer({
          bucket: BUCKET,
          folder: categoria.toLowerCase().replace(/\s+/g, "-"),
          file,
        })

        const tituloDoc = arquivos.length === 1
          ? titulo
          : `${titulo} - ${file.originalname}`

        const documento = await prisma.documentoTransparencia.create({
          data: {
            titulo: tituloDoc,
            descricao: descricao || null,
            categoria,
            arquivo_url: publicUrl,
            arquivo_nome: file.originalname,
            arquivo_tamanho: file.size,
            created_by: req.admin?.id || null,
          },
        })

        documentosCriados.push(documento)
      }

      res.status(201).json({
        success: true,
        message: `${documentosCriados.length} documento(s) criado(s) com sucesso`,
        data: documentosCriados.length === 1 ? documentosCriados[0] : documentosCriados,
      })
    } catch (error) {
      console.error("Erro ao criar documento:", error)
      res.status(500).json({ success: false, message: "Erro ao criar documento", error: error.message })
    }
  },

  async atualizar(req, res) {
    try {
      const { id } = req.params
      const { titulo, descricao, categoria } = req.body

      const existente = await prisma.documentoTransparencia.findUnique({
        where: { id: parseInt(id) },
      })
      if (!existente) {
        return res.status(404).json({ success: false, message: "Documento não encontrado" })
      }

      const dadosAtualizar = {}
      if (titulo) dadosAtualizar.titulo = titulo
      if (descricao !== undefined) dadosAtualizar.descricao = descricao || null
      if (categoria) dadosAtualizar.categoria = categoria

      if (req.file) {
        // Deletar arquivo antigo do storage
        try {
          const urlAntiga = existente.arquivo_url
          const pathMatch = urlAntiga.match(/\/storage\/v1\/object\/public\/transparencia\/(.+)/)
          if (pathMatch) {
            await supabase.storage.from(BUCKET).remove([pathMatch[1]])
          }
        } catch (e) {
          console.warn("Não foi possível remover arquivo antigo:", e.message)
        }

        const { objectPath, publicUrl } = await uploadPublicBuffer({
          bucket: BUCKET,
          folder: (categoria || existente.categoria).toLowerCase().replace(/\s+/g, "-"),
          file: req.file,
        })

        dadosAtualizar.arquivo_url = publicUrl
        dadosAtualizar.arquivo_nome = req.file.originalname
        dadosAtualizar.arquivo_tamanho = req.file.size
      }

      const documento = await prisma.documentoTransparencia.update({
        where: { id: parseInt(id) },
        data: dadosAtualizar,
      })

      res.json({ success: true, data: documento })
    } catch (error) {
      console.error("Erro ao atualizar documento:", error)
      res.status(500).json({ success: false, message: "Erro ao atualizar documento", error: error.message })
    }
  },

  async deletar(req, res) {
    try {
      const { id } = req.params

      const existente = await prisma.documentoTransparencia.findUnique({
        where: { id: parseInt(id) },
      })
      if (!existente) {
        return res.status(404).json({ success: false, message: "Documento não encontrado" })
      }

      // Deletar arquivo do storage
      try {
        const urlAntiga = existente.arquivo_url
        const pathMatch = urlAntiga.match(/\/storage\/v1\/object\/public\/transparencia\/(.+)/)
        if (pathMatch) {
          await supabase.storage.from(BUCKET).remove([pathMatch[1]])
        }
      } catch (e) {
        console.warn("Não foi possível remover arquivo do storage:", e.message)
      }

      await prisma.documentoTransparencia.delete({
        where: { id: parseInt(id) },
      })

      res.json({ success: true, message: "Documento excluído com sucesso" })
    } catch (error) {
      console.error("Erro ao deletar documento:", error)
      res.status(500).json({ success: false, message: "Erro ao deletar documento" })
    }
  },

  async listarCategorias(req, res) {
    try {
      const categorias = await prisma.documentoTransparencia.findMany({
        select: { categoria: true },
        distinct: ["categoria"],
        orderBy: { categoria: "asc" },
      })
      res.json({ success: true, data: categorias.map((c) => c.categoria) })
    } catch (error) {
      res.status(500).json({ success: false, message: "Erro ao listar categorias" })
    }
  },
}

module.exports = TransparenciaController
