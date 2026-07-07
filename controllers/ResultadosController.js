const prisma = require("../lib/prismaClient")
const supabase = require("../lib/supabaseClient")
const { uploadPublicBuffer } = require("../lib/storageService")

const BUCKET = "projetos"
const FOLDER = "resultados"

// O multer entrega file.originalname em latin1; re-decodifica para UTF-8.
function fixFileName(name) {
  if (!name) return name
  try {
    return Buffer.from(name, "latin1").toString("utf8")
  } catch {
    return name
  }
}

const ResultadosController = {
  async listar(req, res) {
    try {
      const resultados = await prisma.resultado.findMany({
        orderBy: [{ ordem: "asc" }, { created_at: "desc" }],
      })
      res.json({ success: true, data: resultados })
    } catch (error) {
      console.error("Erro ao listar resultados:", error)
      res.status(500).json({ success: false, message: "Erro ao listar resultados" })
    }
  },

  async buscarPorId(req, res) {
    try {
      const { id } = req.params
      const resultado = await prisma.resultado.findUnique({ where: { id: parseInt(id) } })
      if (!resultado) {
        return res.status(404).json({ success: false, message: "Resultado não encontrado" })
      }
      res.json({ success: true, data: resultado })
    } catch (error) {
      console.error("Erro ao buscar resultado:", error)
      res.status(500).json({ success: false, message: "Erro ao buscar resultado" })
    }
  },

  async criar(req, res) {
    try {
      const { titulo, ano, ordem } = req.body

      if (!titulo) {
        return res.status(400).json({ success: false, message: "Título é obrigatório" })
      }
      if (!req.file) {
        return res.status(400).json({ success: false, message: "Arquivo é obrigatório" })
      }

      const { publicUrl } = await uploadPublicBuffer({
        bucket: BUCKET,
        folder: FOLDER,
        file: req.file,
      })

      const resultado = await prisma.resultado.create({
        data: {
          titulo,
          ano: ano ? Number(ano) : null,
          arquivo_url: publicUrl,
          arquivo_nome: fixFileName(req.file.originalname),
          arquivo_tamanho: req.file.size,
          ordem: ordem ? Number(ordem) : 0,
          created_by: req.admin?.id || null,
        },
      })

      res.status(201).json({ success: true, message: "Resultado criado com sucesso", data: resultado })
    } catch (error) {
      console.error("Erro ao criar resultado:", error)
      res.status(500).json({ success: false, message: "Erro ao criar resultado", error: error.message })
    }
  },

  async atualizar(req, res) {
    try {
      const { id } = req.params
      const { titulo, ano, ordem } = req.body

      const existente = await prisma.resultado.findUnique({ where: { id: parseInt(id) } })
      if (!existente) {
        return res.status(404).json({ success: false, message: "Resultado não encontrado" })
      }

      const dadosAtualizar = {}
      if (titulo !== undefined) dadosAtualizar.titulo = titulo
      if (ano !== undefined) dadosAtualizar.ano = ano ? Number(ano) : null
      if (ordem !== undefined) dadosAtualizar.ordem = Number(ordem)

      if (req.file) {
        try {
          const urlAntiga = existente.arquivo_url
          const pathMatch = urlAntiga.match(new RegExp(`/storage/v1/object/public/${BUCKET}/(.+)`))
          if (pathMatch) {
            await supabase.storage.from(BUCKET).remove([pathMatch[1]])
          }
        } catch (e) {
          console.warn("Não foi possível remover arquivo antigo:", e.message)
        }

        const { publicUrl } = await uploadPublicBuffer({
          bucket: BUCKET,
          folder: FOLDER,
          file: req.file,
        })

        dadosAtualizar.arquivo_url = publicUrl
        dadosAtualizar.arquivo_nome = fixFileName(req.file.originalname)
        dadosAtualizar.arquivo_tamanho = req.file.size
      }

      const resultado = await prisma.resultado.update({
        where: { id: parseInt(id) },
        data: dadosAtualizar,
      })

      res.json({ success: true, data: resultado })
    } catch (error) {
      console.error("Erro ao atualizar resultado:", error)
      res.status(500).json({ success: false, message: "Erro ao atualizar resultado", error: error.message })
    }
  },

  async deletar(req, res) {
    try {
      const { id } = req.params

      const existente = await prisma.resultado.findUnique({ where: { id: parseInt(id) } })
      if (!existente) {
        return res.status(404).json({ success: false, message: "Resultado não encontrado" })
      }

      try {
        const urlAntiga = existente.arquivo_url
        const pathMatch = urlAntiga.match(new RegExp(`/storage/v1/object/public/${BUCKET}/(.+)`))
        if (pathMatch) {
          await supabase.storage.from(BUCKET).remove([pathMatch[1]])
        }
      } catch (e) {
        console.warn("Não foi possível remover arquivo do storage:", e.message)
      }

      await prisma.resultado.delete({ where: { id: parseInt(id) } })

      res.json({ success: true, message: "Resultado excluído com sucesso" })
    } catch (error) {
      console.error("Erro ao deletar resultado:", error)
      res.status(500).json({ success: false, message: "Erro ao deletar resultado" })
    }
  },
}

module.exports = ResultadosController
