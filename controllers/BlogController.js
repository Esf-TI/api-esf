const prisma = require("../lib/prismaClient")
const { logAdminAction } = require("./AdminController")

const validateBlogData = (data, isUpdate = false) => {
  const errors = []

  if (!isUpdate || data.title) {
    if (!data.title || data.title.trim().length < 5) errors.push("Título deve ter pelo menos 5 caracteres")
    if (data.title && data.title.length > 200) errors.push("Título não pode exceder 200 caracteres")
  }

  if (!isUpdate || data.description) {
    if (!data.description || data.description.trim().length < 20) errors.push("Descrição deve ter pelo menos 20 caracteres")
  }

  if (!isUpdate || data.content) {
    if (!data.content || data.content.trim().length < 50) errors.push("Conteúdo deve ter pelo menos 50 caracteres")
  }

  if (data.author && data.author.length > 100) errors.push("Nome do autor não pode exceder 100 caracteres")

  if (data.status && !["published", "draft", "archived"].includes(data.status)) {
    errors.push("Status inválido. Use: published, draft ou archived")
  }

  return errors
}

const buildSlug = (title) =>
  title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

const CreateBlog = async (req, res) => {
  try {
    const { title, description, content, tags, status = "draft" } = req.body
    const upload = req.file
    const adminId = req.admin?.id || null

    let finalStatus = ["draft", "published", "archived"].includes(status) ? status : "draft"

    const validationErrors = validateBlogData({ ...req.body, status: finalStatus })
    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, message: "Dados inválidos", errors: validationErrors })
    }

    if (!upload || !upload.publicUrl) {
      return res.status(400).json({ success: false, message: "Imagem é obrigatória" })
    }

    const image = upload.publicUrl
    const baseSlug = buildSlug(title)
    const existing = await prisma.blog.findUnique({ where: { slug: baseSlug } })
    const finalSlug = existing ? `${baseSlug}-${Date.now()}` : baseSlug

    const post = await prisma.blog.create({
      data: {
        title,
        description,
        content,
        image,
        author_id: adminId,
        tags: tags && tags.trim() !== "" ? tags : null,
        status: finalStatus,
        slug: finalSlug,
        published_at: finalStatus === "published" ? new Date() : null,
      },
    })

    if (adminId) await logAdminAction(adminId, "BLOG_POST_CREATED", { postId: post.id, title, slug: finalSlug, status: finalStatus })

    res.status(201).json({ success: true, message: "Post criado com sucesso", data: { id: post.id, title, slug: finalSlug, status: finalStatus, image } })
  } catch (error) {
    console.error("Error in CreateBlog:", error)
    res.status(500).json({ success: false, message: "Erro interno do servidor" })
  }
}

const returnAllBlog = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search, sortBy = "created_at", sortOrder = "desc" } = req.query
    const pageNum = Math.max(1, Number(page))
    const limitNum = Math.min(100, Math.max(1, Number(limit)))
    const skip = (pageNum - 1) * limitNum

    const where = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    const validSortColumns = ["created_at", "updated_at", "title", "id"]
    const finalSortBy = validSortColumns.includes(sortBy) ? sortBy : "created_at"
    const finalSortOrder = sortOrder.toLowerCase() === "asc" ? "asc" : "desc"

    const [total, posts] = await Promise.all([
      prisma.blog.count({ where }),
      prisma.blog.findMany({
        where,
        orderBy: { [finalSortBy]: finalSortOrder },
        skip,
        take: limitNum,
      }),
    ])

    res.json({
      success: true,
      data: {
        posts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasMore: skip + posts.length < total,
        },
      },
    })
  } catch (error) {
    console.error("Error in returnAllBlog:", error)
    res.status(500).json({ success: false, message: "Erro interno do servidor" })
  }
}

const returnBlogById = async (req, res) => {
  try {
    const { id } = req.params
    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: "ID inválido" })

    const post = await prisma.blog.findUnique({ where: { id: Number(id) } })
    if (!post) return res.status(404).json({ success: false, message: "Blog não encontrado" })

    res.json({ success: true, data: post })
  } catch (error) {
    console.error("Error in returnBlogById:", error)
    res.status(500).json({ success: false, message: "Erro interno do servidor" })
  }
}

const updateBlog = async (req, res) => {
  try {
    const { id } = req.params
    const { title, description, content, tags, status } = req.body
    const upload = req.file
    const adminId = req.admin?.id || null

    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: "ID inválido" })

    if (!title && !description && !content && !upload && !tags && status === undefined) {
      return res.status(400).json({ success: false, message: "Por favor, forneça pelo menos um campo para atualizar" })
    }

    const validationErrors = validateBlogData(req.body, true)
    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, message: "Dados inválidos", errors: validationErrors })
    }

    if (status && !["published", "draft", "archived"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status inválido. Use: published, draft ou archived" })
    }

    const updateData = {}
    if (title) updateData.title = title
    if (description) updateData.description = description
    if (content) updateData.content = content
    if (tags !== undefined) updateData.tags = tags && tags.trim() !== "" ? tags : null
    if (status) {
      updateData.status = status
      if (status === "published") updateData.published_at = new Date()
    }
    if (upload?.publicUrl) updateData.image = upload.publicUrl

    const post = await prisma.blog.update({ where: { id: Number(id) }, data: updateData })

    if (adminId) await logAdminAction(adminId, "BLOG_POST_UPDATED", { postId: id, fields: Object.keys(req.body) })

    res.json({ success: true, message: "Blog atualizado com sucesso", data: post })
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ success: false, message: "Blog não encontrado" })
    console.error("Error in updateBlog:", error)
    res.status(500).json({ success: false, message: "Erro interno do servidor" })
  }
}

const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params
    const adminId = req.admin?.id

    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: "ID inválido" })

    await prisma.blog.update({ where: { id: Number(id) }, data: { status: "archived" } })

    if (adminId) await logAdminAction(adminId, "BLOG_POST_ARCHIVED", { postId: id })

    res.json({ success: true, message: "Post arquivado com sucesso" })
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ success: false, message: "Post não encontrado" })
    console.error("Error in deleteBlog:", error)
    res.status(500).json({ success: false, message: "Erro interno do servidor" })
  }
}

const permanentDeleteBlog = async (req, res) => {
  try {
    const { id } = req.params
    const adminId = req.admin?.id

    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: "ID inválido" })

    await prisma.blog.delete({ where: { id: Number(id) } })

    if (adminId) await logAdminAction(adminId, "BLOG_POST_DELETED", { postId: id })

    res.json({ success: true, message: "Post deletado permanentemente" })
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ success: false, message: "Post não encontrado" })
    console.error("Error in permanentDeleteBlog:", error)
    res.status(500).json({ success: false, message: "Erro interno do servidor" })
  }
}

module.exports = { CreateBlog, returnAllBlog, returnBlogById, updateBlog, deleteBlog, permanentDeleteBlog }
