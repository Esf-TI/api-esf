const connection = require("../connection")
const BUCKET = "engenheiros-sem-fronteiras.appspot.com"

const validateBlogData = (data) => {
  const errors = []

  if (!data.title || data.title.trim().length < 5) {
    errors.push("Título deve ter pelo menos 5 caracteres")
  }

  if (!data.description || data.description.trim().length < 20) {
    errors.push("Descrição deve ter pelo menos 20 caracteres")
  }

  return errors
}

const CreateBlog = async (req, res) => {
  try {
    const { title, description, author, tags, status = "published" } = req.body
    const upload = req.file
    const adminId = req.admin?.id

    const validationErrors = validateBlogData(req.body)
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

    const image = `https://storage.googleapis.com/${BUCKET}/${upload.filename}`
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")

    const inserirBlog = `
      INSERT INTO Blog (title, description, image, author, tags, status, slug, createdBy, createdAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `

    connection.query(inserirBlog, [title, description, image, author, tags, status, slug, adminId], (err, result) => {
      if (err) {
        console.error("Error creating blog post:", err)
        return res.status(500).json({
          success: false,
          message: "Erro ao criar post do blog",
        })
      }

      if (adminId) {
        const { logAdminAction } = require("./AdminController")
        logAdminAction(adminId, "BLOG_POST_CREATED", {
          postId: result.insertId,
          title,
          author,
        })
      }

      res.status(201).json({
        success: true,
        message: "Post criado com sucesso",
        data: {
          id: result.insertId,
          title,
          slug,
          status,
        },
      })
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
    const {
      page = 1,
      limit = 10,
      status = "published",
      search,
      author,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query

    const offset = (page - 1) * limit
    const whereConditions = ["status = ?"]
    const queryParams = [status]

    if (search) {
      whereConditions.push("(title LIKE ? OR description LIKE ?)")
      queryParams.push(`%${search}%`, `%${search}%`)
    }

    if (author) {
      whereConditions.push("author LIKE ?")
      queryParams.push(`%${author}%`)
    }

    const whereClause = `WHERE ${whereConditions.join(" AND ")}`

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
        SELECT *, 
        DATE_FORMAT(createdAt, '%d/%m/%Y %H:%i') as formattedDate
        FROM Blog 
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
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
  const { id } = req.params
  const selectBlogQuery = "SELECT * FROM Blog WHERE id = ?"

  connection.query(selectBlogQuery, [id], (err, rows) => {
    if (err) {
      console.error("Erro ao buscar blog por ID:", err)
      return res.status(500).send("Erro interno do servidor")
    }

    // Verifica se o blog foi encontrado
    if (rows.length === 0) {
      return res.status(404).send("Blog não encontrado")
    }

    // Retorna as informações do blog encontrado
    res.status(200).json(rows[0])
  })
}

const updateBlog = (req, res) => {
  const { id } = req.params
  const { title, description } = req.body
  const upload = req.file
  console.log(upload)
  // Verifica se o ID do blog é fornecido
  if (!id) {
    return res.status(400).send("ID do blog não fornecido")
  }

  // Verifica se pelo menos um dos campos (título, descrição, imagem) foi fornecido
  if (!title && !description && !upload) {
    return res.status(400).send("Por favor, forneça pelo menos um dos campos: título, descrição ou imagem")
  }

  // Constrói a consulta de atualização com base nos campos fornecidos
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

  if (upload && upload.filename) {
    const image = `https://storage.googleapis.com/${BUCKET}/${upload.filename}`
    updateBlogQuery += " image = ?,"
    queryParams.push(image)
  }

  // Remove a última vírgula da consulta de atualização
  updateBlogQuery = updateBlogQuery.slice(0, -1)

  updateBlogQuery += " WHERE id = ?"
  queryParams.push(id)

  // Executa a consulta de atualização
  connection.query(updateBlogQuery, queryParams, (err, result) => {
    if (err) {
      console.error("Erro ao atualizar o blog:", err)
      return res.status(500).send("Erro interno do servidor")
    }

    // Verifica se o blog foi atualizado com sucesso
    if (result.affectedRows === 0) {
      return res.status(404).send("Blog não encontrado")
    }

    // Retorna uma mensagem de sucesso
    res.status(200).send("Blog atualizado com sucesso")
  })
}

const deleteBlog = (req, res) => {
  const { id } = req.params

  // Verifica se o ID do post é fornecido
  if (!id) {
    return res.status(400).send("ID do post não fornecido")
  }

  // Query para deletar o post do banco de dados
  const deletePostQuery = "DELETE FROM Blog WHERE id = ?"

  connection.query(deletePostQuery, [id], (err, result) => {
    if (err) {
      console.error("Erro ao deletar o post:", err)
      return res.status(500).send("Erro interno do servidor")
    }

    // Verifica se o post foi deletado com sucesso
    if (result.affectedRows === 0) {
      return res.status(404).send("Post não encontrado")
    }

    // Retorna uma mensagem de sucesso
    res.status(200).send("Post deletado com sucesso")
  })
}

module.exports = {
  CreateBlog,
  returnAllBlog,
  updateBlog,
  deleteBlog,
  returnBlogById,
}
