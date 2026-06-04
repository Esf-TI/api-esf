const prisma = require("../lib/prismaClient")
const { validationResult } = require("express-validator")
const { getPagination, buildMeta } = require("../lib/pagination")

// Campos leves para listagem (evita trafegar JSON pesado de authors/keywords nas listas).
const LIST_SELECT = {
  id: true,
  title: true,
  description: true,
  year: true,
  event_name: true,
  cover_image_url: true,
  pdf_url: true,
  category: true,
  status: true,
  authors: true,
  pages: true,
  isbn: true,
  downloads: true,
  views: true,
  featured: true,
  created_at: true,
}

const validCategories = ["Sustentabilidade", "Infraestrutura e Assistência Básica", "Gestão e Empreendedorismo", "Educação"]
const validStatus = ["active", "archived"]

class AnaisController {
  async indexPublished(req, res) {
    try {
      const { category, year, search, event } = req.query

      const where = { status: "active" }
      if (category && category !== "Todos") where.category = category
      if (year && year !== "Todos") where.year = Number(year)
      if (event) where.event_name = { contains: event, mode: "insensitive" }
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { event_name: { contains: search, mode: "insensitive" } },
        ]
      }

      const pag = getPagination(req.query)
      const [anais, total] = await Promise.all([
        prisma.anais.findMany({
          where,
          select: LIST_SELECT,
          orderBy: [{ year: "desc" }, { created_at: "desc" }],
          ...(pag.enabled ? { take: pag.take, skip: pag.skip } : {}),
        }),
        pag.enabled ? prisma.anais.count({ where }) : Promise.resolve(undefined),
      ])

      return res.status(200).json({ success: true, count: anais.length, data: anais, pagination: buildMeta(total, pag) })
    } catch (error) {
      console.error("Error fetching published anais:", error)
      return res.status(500).json({ success: false, message: "Erro ao buscar publicações", error: error.message })
    }
  }

  async index(req, res) {
    try {
      const { category, year, search, status, event } = req.query

      const where = { NOT: { status: "deleted" } }
      if (category && category !== "Todos") where.category = category
      if (year && year !== "Todos") where.year = Number(year)
      if (status) where.status = status
      if (event) where.event_name = { contains: event, mode: "insensitive" }
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { event_name: { contains: search, mode: "insensitive" } },
        ]
      }

      const pag = getPagination(req.query)
      const [anais, total] = await Promise.all([
        prisma.anais.findMany({
          where,
          select: LIST_SELECT,
          orderBy: [{ year: "desc" }, { created_at: "desc" }],
          ...(pag.enabled ? { take: pag.take, skip: pag.skip } : {}),
        }),
        pag.enabled ? prisma.anais.count({ where }) : Promise.resolve(undefined),
      ])

      return res.status(200).json({ success: true, count: anais.length, data: anais, pagination: buildMeta(total, pag) })
    } catch (error) {
      console.error("Error fetching anais:", error)
      return res.status(500).json({ success: false, message: "Erro ao buscar publicações", error: error.message })
    }
  }

  async show(req, res) {
    try {
      const { id } = req.params
      if (!id || isNaN(id)) return res.status(400).json({ success: false, message: "ID inválido" })

      const anal = await prisma.anais.findFirst({ where: { id: Number(id), NOT: { status: "deleted" } } })
      if (!anal) return res.status(404).json({ success: false, message: "Publicação não encontrada" })

      return res.status(200).json({ success: true, data: anal })
    } catch (error) {
      console.error("Error fetching anal:", error)
      return res.status(500).json({ success: false, message: "Erro ao buscar publicação", error: error.message })
    }
  }

  async store(req, res) {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "Erro de validação", errors: errors.array() })
      }

      const { title, authors, category, year, pdf_url, description, event_name, status = "active" } = req.body

      if (!title || !authors || !category || !year || !pdf_url) {
        return res.status(400).json({ success: false, message: "Campos obrigatórios: title, authors, category, year, pdf_url" })
      }

      if (!Array.isArray(authors) || authors.length === 0) {
        return res.status(400).json({ success: false, message: "Authors deve ser um array não vazio" })
      }

      if (!validCategories.includes(category)) {
        return res.status(400).json({ success: false, message: "Categoria inválida", validCategories })
      }

      const currentYear = new Date().getFullYear()
      if (isNaN(year) || year < 2000 || year > currentYear + 1) {
        return res.status(400).json({ success: false, message: `Ano inválido. Deve estar entre 2000 e ${currentYear + 1}` })
      }

      const finalStatus = validStatus.includes(status) ? status : "active"

      const anais = await prisma.anais.create({
        data: {
          title,
          authors,
          category,
          year: Number(year),
          pdf_url,
          description: description || null,
          event_name: event_name || null,
          status: finalStatus,
        },
      })

      return res.status(201).json({ success: true, message: "Publicação criada com sucesso", data: anais })
    } catch (error) {
      console.error("Error creating anal:", error)
      return res.status(500).json({ success: false, message: "Erro ao criar publicação", error: error.message })
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params
      if (!id || isNaN(id)) return res.status(400).json({ success: false, message: "ID inválido" })

      const { title, authors, category, year, pdf_url, description, event_name, status } = req.body

      const existing = await prisma.anais.findFirst({ where: { id: Number(id), NOT: { status: "deleted" } } })
      if (!existing) return res.status(404).json({ success: false, message: "Publicação não encontrada" })

      if (category && !validCategories.includes(category)) {
        return res.status(400).json({ success: false, message: "Categoria inválida", validCategories })
      }

      if (authors && (!Array.isArray(authors) || authors.length === 0)) {
        return res.status(400).json({ success: false, message: "Authors deve ser um array não vazio" })
      }

      if (year) {
        const currentYear = new Date().getFullYear()
        if (isNaN(year) || year < 2000 || year > currentYear + 1) {
          return res.status(400).json({ success: false, message: `Ano inválido. Deve estar entre 2000 e ${currentYear + 1}` })
        }
      }

      if (status && !validStatus.includes(status)) {
        return res.status(400).json({ success: false, message: "Status inválido. Use: active ou archived" })
      }

      const updateData = {}
      if (title !== undefined) updateData.title = title
      if (authors !== undefined) updateData.authors = authors
      if (category !== undefined) updateData.category = category
      if (year !== undefined) updateData.year = Number(year)
      if (pdf_url !== undefined) updateData.pdf_url = pdf_url
      if (description !== undefined) updateData.description = description
      if (event_name !== undefined) updateData.event_name = event_name || null
      if (status !== undefined) updateData.status = status

      const updated = await prisma.anais.update({ where: { id: Number(id) }, data: updateData })

      return res.status(200).json({ success: true, message: "Publicação atualizada com sucesso", data: updated })
    } catch (error) {
      console.error("Error updating anal:", error)
      return res.status(500).json({ success: false, message: "Erro ao atualizar publicação", error: error.message })
    }
  }

  async destroy(req, res) {
    try {
      const { id } = req.params
      if (!id || isNaN(id)) return res.status(400).json({ success: false, message: "ID inválido" })

      const existing = await prisma.anais.findFirst({ where: { id: Number(id), NOT: { status: "deleted" } } })
      if (!existing) return res.status(404).json({ success: false, message: "Publicação não encontrada" })

      await prisma.anais.update({ where: { id: Number(id) }, data: { status: "deleted" } })

      return res.status(200).json({ success: true, message: "Publicação arquivada com sucesso" })
    } catch (error) {
      console.error("Error archiving anal:", error)
      return res.status(500).json({ success: false, message: "Erro ao arquivar publicação", error: error.message })
    }
  }

  async stats(req, res) {
    try {
      const [total, active, archived] = await Promise.all([
        prisma.anais.count({ where: { NOT: { status: "deleted" } } }),
        prisma.anais.count({ where: { status: "active" } }),
        prisma.anais.count({ where: { status: "archived" } }),
      ])

      return res.status(200).json({ success: true, data: { total, active, archived } })
    } catch (error) {
      console.error("Error fetching stats:", error)
      return res.status(500).json({ success: false, message: "Erro ao buscar estatísticas", error: error.message })
    }
  }
}

module.exports = new AnaisController()
