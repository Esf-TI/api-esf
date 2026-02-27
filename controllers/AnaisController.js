const Anais = require("../models/Anais")
const { validationResult } = require("express-validator")

class AnaisController {
  // Listar APENAS publicações publicadas (para página pública)
  async indexPublished(req, res) {
    try {
      const { category, year, search, event } = req.query

      const filters = {
        category: category || null,
        year: year || null,
        search: search || null,
        status: "published", // FORÇA apenas publicadas
        event: event || null,
      }

      const anais = await Anais.findAll(filters)

      return res.status(200).json({
        success: true,
        count: anais.length,
        data: anais,
      })
    } catch (error) {
      console.error("Error fetching published anais:", error)
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar publicações",
        error: error.message,
      })
    }
  }

  // Listar todos os anais com filtros opcionais (para admin)
  async index(req, res) {
    try {
      const { category, year, search, status, event } = req.query

      const filters = {
        category: category || null,
        year: year || null,
        search: search || null,
        status: status || null,
        event: event || null,
      }

      const anais = await Anais.findAll(filters)

      return res.status(200).json({
        success: true,
        count: anais.length,
        data: anais,
      })
    } catch (error) {
      console.error("Error fetching anais:", error)
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar publicações",
        error: error.message,
      })
    }
  }

  // Buscar um anal específico
  async show(req, res) {
    try {
      const { id } = req.params

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID inválido",
        })
      }

      const anal = await Anais.findById(id)

      if (!anal) {
        return res.status(404).json({
          success: false,
          message: "Anal não encontrado",
        })
      }

      return res.status(200).json({
        success: true,
        data: anal,
      })
    } catch (error) {
      console.error("Error fetching anal:", error)
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar anal",
        error: error.message,
      })
    }
  }

  // Criar novo anal
  async store(req, res) {
    try {
      // Validação de erros
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Erro de validação",
          errors: errors.array(),
        })
      }

      const { title, authors, category, year, pdf_url, description, event_name, status = "active" } = req.body

      // Validações adicionais
      if (!title || !authors || !category || !year || !pdf_url) {
        return res.status(400).json({
          success: false,
          message: "Campos obrigatórios: title, authors, category, year, pdf_url",
        })
      }

      // Validar que authors é um array
      if (!Array.isArray(authors) || authors.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Authors deve ser um array não vazio",
        })
      }

      // Validar categoria
      const validCategories = [
        "Sustentabilidade",
        "Infraestrutura e Assistência Básica",
        "Gestão e Empreendedorismo",
        "Educação",
      ]

      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          message: "Categoria inválida",
          validCategories,
        })
      }

      // Validar ano
      const currentYear = new Date().getFullYear()
      if (isNaN(year) || year < 2000 || year > currentYear + 1) {
        return res.status(400).json({
          success: false,
          message: `Ano inválido. Deve estar entre 2000 e ${currentYear + 1}`,
        })
      }

      // Validar status
      const validStatus = ["active", "archived"]
      const finalStatus = validStatus.includes(status) ? status : "active"

      const newAnal = await Anais.create({
        title,
        authors,
        category,
        year: year.toString(),
        pdf_url,
        description,
        event_name: event_name || null,
        status: finalStatus,
      })

      return res.status(201).json({
        success: true,
        message: "Anal criado com sucesso",
        data: newAnal,
      })
    } catch (error) {
      console.error("Error creating anal:", error)
      return res.status(500).json({
        success: false,
        message: "Erro ao criar anal",
        error: error.message,
      })
    }
  }

  // Atualizar anal existente
  async update(req, res) {
    try {
      const { id } = req.params
      const { title, authors, category, year, pdf_url, description, event_name, status } = req.body

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID inválido",
        })
      }

      // Verificar se o anal existe
      const existingAnal = await Anais.findById(id)
      if (!existingAnal) {
        return res.status(404).json({
          success: false,
          message: "Anal não encontrado",
        })
      }

      // Validar categoria se fornecida
      if (category) {
        const validCategories = [
          "Sustentabilidade",
          "Infraestrutura e Assistência Básica",
          "Gestão e Empreendedorismo",
          "Educação",
        ]

        if (!validCategories.includes(category)) {
          return res.status(400).json({
            success: false,
            message: "Categoria inválida",
            validCategories,
          })
        }
      }

      // Validar authors se fornecido
      if (authors && (!Array.isArray(authors) || authors.length === 0)) {
        return res.status(400).json({
          success: false,
          message: "Authors deve ser um array não vazio",
        })
      }

      // Validar ano se fornecido
      if (year) {
        const currentYear = new Date().getFullYear()
        if (isNaN(year) || year < 2000 || year > currentYear + 1) {
          return res.status(400).json({
            success: false,
            message: `Ano inválido. Deve estar entre 2000 e ${currentYear + 1}`,
          })
        }
      }

      // Validar status se fornecido
      if (status) {
        const validStatus = ["active", "archived"]
        if (!validStatus.includes(status)) {
          return res.status(400).json({
            success: false,
            message: "Status inválido. Use: active ou archived",
          })
        }
      }

      // Construir objeto com apenas os campos fornecidos
      const updateData = {}
      if (title !== undefined) updateData.title = title
      if (authors !== undefined) updateData.authors = authors
      if (category !== undefined) updateData.category = category
      if (year !== undefined) updateData.year = year?.toString()
      if (pdf_url !== undefined) updateData.pdf_url = pdf_url
      if (description !== undefined) updateData.description = description
      if (event_name !== undefined) updateData.event_name = event_name || null
      if (status !== undefined) updateData.status = status

      console.log("[v0] UPDATE - updateData being sent to model:", JSON.stringify(updateData, null, 2))
      console.log("[v0] UPDATE - category value:", updateData.category)

      const updatedAnal = await Anais.update(id, updateData)

      console.log("[v0] UPDATE - updatedAnal returned from model:", JSON.stringify(updatedAnal, null, 2))

      return res.status(200).json({
        success: true,
        message: "Anal atualizado com sucesso",
        data: updatedAnal,
      })
    } catch (error) {
      console.error("Error updating anal:", error)
      return res.status(500).json({
        success: false,
        message: "Erro ao atualizar anal",
        error: error.message,
      })
    }
  }

  // Arquivar anal (soft delete)
  async destroy(req, res) {
    try {
      const { id } = req.params

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID inválido",
        })
      }

      const anal = await Anais.findById(id)
      if (!anal) {
        return res.status(404).json({
          success: false,
          message: "Anal não encontrado",
        })
      }

      await Anais.archive(id)

      return res.status(200).json({
        success: true,
        message: "Anal arquivado com sucesso",
      })
    } catch (error) {
      console.error("Error archiving anal:", error)
      return res.status(500).json({
        success: false,
        message: "Erro ao arquivar publicação",
        error: error.message,
      })
    }
  }

  // Obter estatísticas dos anais
  async stats(req, res) {
    try {
      const stats = await Anais.getStats()

      return res.status(200).json({
        success: true,
        data: stats,
      })
    } catch (error) {
      console.error("Error fetching stats:", error)
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar estatísticas",
        error: error.message,
      })
    }
  }
}

module.exports = new AnaisController()
