const connection = require("../connection")
const { logAdminAction } = require("./AdminController")

const validateBlogData = (data, isUpdate = false) => {
  const errors = []

  if (!isUpdate || data.title) {
    if (!data.title || data.title.trim().length < 5) {
      errors.push("Título deve ter pelo menos 5 caracteres")
    }
    if (data.title && data.title.length > 200) {
      errors.push("Título não pode exceder 200 caracteres")
    }
  }

  if (!isUpdate || data.description) {
    if (!data.description || data.description.trim().length < 20) {
      errors.push("Descrição deve ter pelo menos 20 caracteres")
    }
  }

  if (!isUpdate || data.content) {
    if (!data.content || data.content.trim().length < 50) {
      errors.push("Conteúdo deve ter pelo menos 50 caracteres")
    }
  }

  if (data.author && data.author.length > 100) {
    errors.push("Nome do autor não pode exceder 100 caracteres")
  }

  if (data.status && !["published", "draft", "archived"].includes(data.status)) {
    errors.push("Status inválido. Use: published, draft ou archived")
  }

  return errors
}

const CreateBlog = async (req, res) => {
  try {
    const { title, description, content, tags, status = "draft" } = req.body
    const upload = req.file
    const adminId = req.admin?.id || null

    // Validação - status pode ser draft, published ou archived
    let finalStatus = status || "draft"
    if (!["draft", "published", "archived"].includes(finalStatus)) {
      finalStatus = "draft"
    }

    // Validation
    const validationErrors = validateBlogData({ ...req.body, status: finalStatus })
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Dados inválidos",
        errors: validationErrors,
      })
    }

    if (!upload || !upload.filename) {
      return res.status(400).json({
        success: false,
        message: "Imagem é obrigatória",
      })
    }

    // URL local do arquivo (semelhante ao padrão de Anais)
    const image = `/uploads/blog/${upload.filename}`
    const slug = title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")

    // Check if slug already exists
    const checkSlugSql = "SELECT id FROM Blog WHERE slug = ?"
    connection.query(checkSlugSql, [slug], (err, existingSlug) => {
      if (err) {
        console.error("Error checking slug:", err)
        return res.status(500).json({
          success: false,
          message: "Erro ao verificar slug",
        })
      }

      const finalSlug = existingSlug.length > 0 ? `${slug}-${Date.now()}` : slug

      const tagsValue = tags && tags.trim() !== "" ? tags : null

      const inserirBlog = `
        INSERT INTO Blog (title, description, content, image, author_id, tags, status, slug, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `

      connection.query(
        inserirBlog,
        [title, description, content, image, adminId, tagsValue, finalStatus, finalSlug],
        (err, result) => {
          if (err) {
            console.error("Error creating blog post:", err)
            return res.status(500).json({
              success: false,
              message: "Erro ao criar post do blog",
              error: process.env.NODE_ENV === "development" ? err.message : undefined,
            })
          }

          if (adminId) {
            logAdminAction(adminId, "BLOG_POST_CREATED", {
              postId: result.insertId,
              title,
              slug: finalSlug,
              status: finalStatus,
            })
          }

          res.status(201).json({
            success: true,
            message: "Post criado com sucesso",
            data: {
              id: result.insertId,
              title,
              slug: finalSlug,
              status: finalStatus,
              image,
            },
          })
        },
      )
    })
  } catch (error) {
    console.error("Error in CreateBlog:", error)
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
    })
  }
}

const returnAllBlog = (req, res) => {
  try {
    const { page = 1, limit = 10, status, search, sortBy = "created_at", sortOrder = "DESC" } = req.query

    const offset = (page - 1) * limit
    const whereConditions = []
    const queryParams = []

    if (status) {
      whereConditions.push("status = ?")
      queryParams.push(status)
    }

    if (search) {
      whereConditions.push("(title LIKE ? OR description LIKE ? OR tags LIKE ?)")
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : ""

    const validSortColumns = ["created_at", "updated_at", "title", "id"]
    const finalSortBy = validSortColumns.includes(sortBy) ? sortBy : "created_at"
    const finalSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC"

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM Blog ${whereClause}`

    connection.query(countSql, queryParams, (err, countResult) => {
      if (err) {
        console.error("Error counting blog posts:", err)
        return res.status(500).json({
          success: false,
          message: "Erro ao contar posts",
        })
      }

      const total = countResult[0].total

      // Get posts
      const sql = `
        SELECT 
          id, title, description, content, image, author_id, tags, status, slug,
          DATE_FORMAT(created_at, '%d/%m/%Y %H:%i') as formattedDate,
          created_at, updated_at
        FROM Blog 
        ${whereClause}
        ORDER BY ${finalSortBy} ${finalSortOrder}
        LIMIT ? OFFSET ?
      `

      queryParams.push(Number.parseInt(limit), Number.parseInt(offset))

      connection.query(sql, queryParams, (err, results) => {
        if (err) {
          console.error("Error fetching blog posts:", err)
          return res.status(500).json({
            success: false,
            message: "Erro ao buscar posts",
          })
        }

        res.json({
          success: true,
          data: {
            posts: results,
            pagination: {
              page: Number.parseInt(page),
              limit: Number.parseInt(limit),
              total,
              totalPages: Math.ceil(total / limit),
              hasMore: offset + results.length < total,
            },
          },
        })
      })
    })
  } catch (error) {
    console.error("Error in returnAllBlog:", error)
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
    })
  }
}

const returnBlogById = (req, res) => {
  try {
    const { id } = req.params

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "ID inválido",
      })
    }

    const sql = "SELECT * FROM Blog WHERE id = ?"

    connection.query(sql, [id], (err, rows) => {
      if (err) {
        console.error("Erro ao buscar blog por ID:", err)
        return res.status(500).json({
          success: false,
          message: "Erro interno do servidor",
        })
      }

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Blog não encontrado",
        })
      }

      res.json({
        success: true,
        data: rows[0],
      })
    })
  } catch (error) {
    console.error("Error in returnBlogById:", error)
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
    })
  }
}

const updateBlog = (req, res) => {
  try {
    const { id } = req.params
    const { title, description, content, tags, status } = req.body
    const upload = req.file
    const adminId = req.admin?.id || null

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "ID inválido",
      })
    }

    // Permitir atualizar apenas um campo de cada vez
    if (!title && !description && !content && !upload && !tags && status === undefined) {
      return res.status(400).json({
        success: false,
        message: "Por favor, forneça pelo menos um campo para atualizar",
      })
    }

    const validationErrors = validateBlogData(req.body, true)
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Dados inválidos",
        errors: validationErrors,
      })
    }

    let updateBlogQuery = "UPDATE Blog SET"
    const queryParams = []

    if (title) {
      updateBlogQuery += " title = ?,"
      queryParams.push(title)
    }

    if (description) {
      updateBlogQuery += " description = ?,"
      queryParams.push(description)
    }

    if (content) {
      updateBlogQuery += " content = ?,"
      queryParams.push(content)
    }

    if (tags !== undefined) {
      const tagsValue = tags && tags.trim() !== "" ? tags : null
      updateBlogQuery += " tags = ?,"
      queryParams.push(tagsValue)
    }

    // Fixo: status deve ser validado e atualizado corretamente
    if (status !== undefined && status !== null && status !== "") {
      if (!["published", "draft", "archived"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status inválido. Use: published, draft ou archived",
        })
      }
      updateBlogQuery += " status = ?,"
      queryParams.push(status)
    }

    if (upload && upload.filename) {
      // URL local do arquivo (semelhante ao padrão de Anais)
      const image = `/uploads/blog/${upload.filename}`
      updateBlogQuery += " image = ?,"
      queryParams.push(image)
    }

    updateBlogQuery += " updated_at = NOW()"
    updateBlogQuery += " WHERE id = ?"
    queryParams.push(id)

    connection.query(updateBlogQuery, queryParams, (err, result) => {
      if (err) {
        console.error("Erro ao atualizar o blog:", err)
        return res.status(500).json({
          success: false,
          message: "Erro interno do servidor",
        })
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "Blog não encontrado",
        })
      }

      if (adminId) {
        logAdminAction(adminId, "BLOG_POST_UPDATED", { postId: id, fields: Object.keys(req.body) })
      }

      res.json({
        success: true,
        message: "Blog atualizado com sucesso",
        data: { id, ...req.body },
      })
    })
  } catch (error) {
    console.error("Error in updateBlog:", error)
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
    })
  }
}

const deleteBlog = (req, res) => {
  try {
    const { id } = req.params
    const adminId = req.admin?.id

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "ID inválido",
      })
    }

    const archiveQuery = "UPDATE Blog SET status = 'archived', updated_at = NOW() WHERE id = ?"

    connection.query(archiveQuery, [id], (err, result) => {
      if (err) {
        console.error("Erro ao arquivar o post:", err)
        return res.status(500).json({
          success: false,
          message: "Erro interno do servidor",
        })
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "Post não encontrado",
        })
      }

      if (adminId) {
        logAdminAction(adminId, "BLOG_POST_ARCHIVED", { postId: id })
      }

      res.json({
        success: true,
        message: "Post arquivado com sucesso",
      })
    })
  } catch (error) {
    console.error("Error in deleteBlog:", error)
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
    })
  }
}

const permanentDeleteBlog = (req, res) => {
  try {
    const { id } = req.params
    const adminId = req.admin?.id

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "ID inválido",
      })
    }

    const deleteQuery = "DELETE FROM Blog WHERE id = ?"

    connection.query(deleteQuery, [id], (err, result) => {
      if (err) {
        console.error("Erro ao deletar o post:", err)
        return res.status(500).json({
          success: false,
          message: "Erro interno do servidor",
        })
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "Post não encontrado",
        })
      }

      if (adminId) {
        logAdminAction(adminId, "BLOG_POST_DELETED_PERMANENTLY", { postId: id })
      }

      res.json({
        success: true,
        message: "Post deletado permanentemente",
      })
    })
  } catch (error) {
    console.error("Error in permanentDeleteBlog:", error)
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
    })
  }
}

module.exports = {
  CreateBlog,
  returnAllBlog,
  updateBlog,
  deleteBlog,
  permanentDeleteBlog,
  returnBlogById,
}
