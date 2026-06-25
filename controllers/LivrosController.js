const prisma = require("../lib/prismaClient")
const { validationResult } = require("express-validator")
const { getPagination, buildMeta } = require("../lib/pagination")

const LIST_SELECT = {
  id: true,
  titulo: true,
  descricao: true,
  autores: true,
  editora: true,
  ano: true,
  edicao: true,
  isbn: true,
  capa_url: true,
  pdf_url: true,
  link_compra: true,
  status: true,
  featured: true,
  created_at: true,
}

const validStatus = ["active", "archived"]

class LivrosController {
  async indexPublished(req, res) {
    try {
      const { ano, search } = req.query

      const where = { status: "active" }
      if (ano && ano !== "Todos") where.ano = Number(ano)
      if (search) {
        where.OR = [
          { titulo: { contains: search, mode: "insensitive" } },
          { editora: { contains: search, mode: "insensitive" } },
        ]
      }

      const pag = getPagination(req.query)
      const [livros, total] = await Promise.all([
        prisma.livro.findMany({
          where,
          select: LIST_SELECT,
          orderBy: [{ featured: "desc" }, { ano: "desc" }, { created_at: "desc" }],
          ...(pag.enabled ? { take: pag.take, skip: pag.skip } : {}),
        }),
        pag.enabled ? prisma.livro.count({ where }) : Promise.resolve(undefined),
      ])

      return res.status(200).json({ success: true, count: livros.length, data: livros, pagination: buildMeta(total, pag) })
    } catch (error) {
      console.error("Error fetching published livros:", error)
      return res.status(500).json({ success: false, message: "Erro ao buscar livros", error: error.message })
    }
  }

  async index(req, res) {
    try {
      const { ano, search, status } = req.query

      const where = { NOT: { status: "deleted" } }
      if (ano && ano !== "Todos") where.ano = Number(ano)
      if (status) where.status = status
      if (search) {
        where.OR = [
          { titulo: { contains: search, mode: "insensitive" } },
          { editora: { contains: search, mode: "insensitive" } },
        ]
      }

      const pag = getPagination(req.query)
      const [livros, total] = await Promise.all([
        prisma.livro.findMany({
          where,
          select: LIST_SELECT,
          orderBy: [{ ano: "desc" }, { created_at: "desc" }],
          ...(pag.enabled ? { take: pag.take, skip: pag.skip } : {}),
        }),
        pag.enabled ? prisma.livro.count({ where }) : Promise.resolve(undefined),
      ])

      return res.status(200).json({ success: true, count: livros.length, data: livros, pagination: buildMeta(total, pag) })
    } catch (error) {
      console.error("Error fetching livros:", error)
      return res.status(500).json({ success: false, message: "Erro ao buscar livros", error: error.message })
    }
  }

  async show(req, res) {
    try {
      const { id } = req.params
      if (!id || isNaN(id)) return res.status(400).json({ success: false, message: "ID inválido" })

      const livro = await prisma.livro.findFirst({ where: { id: Number(id), NOT: { status: "deleted" } } })
      if (!livro) return res.status(404).json({ success: false, message: "Livro não encontrado" })

      return res.status(200).json({ success: true, data: livro })
    } catch (error) {
      console.error("Error fetching livro:", error)
      return res.status(500).json({ success: false, message: "Erro ao buscar livro", error: error.message })
    }
  }

  async store(req, res) {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "Erro de validação", errors: errors.array() })
      }

      const { titulo, autores, editora, ano, edicao, isbn, capa_url, pdf_url, link_compra, descricao, status = "active" } = req.body

      if (!titulo || !ano) {
        return res.status(400).json({ success: false, message: "Campos obrigatórios: titulo, ano" })
      }

      if (autores && !Array.isArray(autores)) {
        return res.status(400).json({ success: false, message: "autores deve ser um array" })
      }

      const currentYear = new Date().getFullYear()
      if (isNaN(ano) || ano < 1900 || ano > currentYear + 1) {
        return res.status(400).json({ success: false, message: `Ano inválido. Deve estar entre 1900 e ${currentYear + 1}` })
      }

      const finalStatus = validStatus.includes(status) ? status : "active"

      const livro = await prisma.livro.create({
        data: {
          titulo,
          descricao: descricao || null,
          autores: autores || [],
          editora: editora || null,
          ano: Number(ano),
          edicao: edicao || null,
          isbn: isbn || null,
          capa_url: capa_url || null,
          pdf_url: pdf_url || null,
          link_compra: link_compra || null,
          status: finalStatus,
        },
      })

      return res.status(201).json({ success: true, message: "Livro criado com sucesso", data: livro })
    } catch (error) {
      console.error("Error creating livro:", error)
      return res.status(500).json({ success: false, message: "Erro ao criar livro", error: error.message })
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params
      if (!id || isNaN(id)) return res.status(400).json({ success: false, message: "ID inválido" })

      const existing = await prisma.livro.findFirst({ where: { id: Number(id), NOT: { status: "deleted" } } })
      if (!existing) return res.status(404).json({ success: false, message: "Livro não encontrado" })

      const { titulo, autores, editora, ano, edicao, isbn, capa_url, pdf_url, link_compra, descricao, status, featured } = req.body

      if (autores !== undefined && !Array.isArray(autores)) {
        return res.status(400).json({ success: false, message: "autores deve ser um array" })
      }

      if (ano !== undefined) {
        const currentYear = new Date().getFullYear()
        if (isNaN(ano) || ano < 1900 || ano > currentYear + 1) {
          return res.status(400).json({ success: false, message: `Ano inválido. Deve estar entre 1900 e ${currentYear + 1}` })
        }
      }

      if (status !== undefined && !validStatus.includes(status)) {
        return res.status(400).json({ success: false, message: "Status inválido. Use: active ou archived" })
      }

      const updateData = {}
      if (titulo !== undefined) updateData.titulo = titulo
      if (descricao !== undefined) updateData.descricao = descricao
      if (autores !== undefined) updateData.autores = autores
      if (editora !== undefined) updateData.editora = editora || null
      if (ano !== undefined) updateData.ano = Number(ano)
      if (edicao !== undefined) updateData.edicao = edicao || null
      if (isbn !== undefined) updateData.isbn = isbn || null
      if (capa_url !== undefined) updateData.capa_url = capa_url || null
      if (pdf_url !== undefined) updateData.pdf_url = pdf_url || null
      if (link_compra !== undefined) updateData.link_compra = link_compra || null
      if (status !== undefined) updateData.status = status
      if (featured !== undefined) updateData.featured = Boolean(featured)

      const updated = await prisma.livro.update({ where: { id: Number(id) }, data: updateData })

      return res.status(200).json({ success: true, message: "Livro atualizado com sucesso", data: updated })
    } catch (error) {
      console.error("Error updating livro:", error)
      return res.status(500).json({ success: false, message: "Erro ao atualizar livro", error: error.message })
    }
  }

  async destroy(req, res) {
    try {
      const { id } = req.params
      if (!id || isNaN(id)) return res.status(400).json({ success: false, message: "ID inválido" })

      const existing = await prisma.livro.findFirst({ where: { id: Number(id), NOT: { status: "deleted" } } })
      if (!existing) return res.status(404).json({ success: false, message: "Livro não encontrado" })

      await prisma.livro.update({ where: { id: Number(id) }, data: { status: "deleted" } })

      return res.status(200).json({ success: true, message: "Livro removido com sucesso" })
    } catch (error) {
      console.error("Error deleting livro:", error)
      return res.status(500).json({ success: false, message: "Erro ao remover livro", error: error.message })
    }
  }

  async stats(req, res) {
    try {
      const [total, active, archived] = await Promise.all([
        prisma.livro.count({ where: { NOT: { status: "deleted" } } }),
        prisma.livro.count({ where: { status: "active" } }),
        prisma.livro.count({ where: { status: "archived" } }),
      ])

      return res.status(200).json({ success: true, data: { total, active, archived } })
    } catch (error) {
      console.error("Error fetching livros stats:", error)
      return res.status(500).json({ success: false, message: "Erro ao buscar estatísticas", error: error.message })
    }
  }
}

module.exports = new LivrosController()
