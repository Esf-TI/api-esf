const bcrypt = require("bcrypt")
const prisma = require("../lib/prismaClient")
const { generateTokens, refreshAccessToken } = require("../middlewares/authFunctions")
const { GetAllNucleos, GetNucleoById, CreateNucleo } = require("./NucleosControllers")

const logAdminAction = async (adminId, action, details = {}) => {
  try {
    await prisma.adminLog.create({
      data: {
        adminId: adminId || null,
        action,
        details,
        timestamp: new Date(),
      },
    })
  } catch (err) {
    console.error("Error logging admin action:", err)
  }
}

const validateInput = (data, requiredFields) => {
  const errors = []
  requiredFields.forEach((field) => {
    if (!data[field] || data[field].toString().trim() === "") {
      errors.push(`${field} é obrigatório`)
    }
  })
  return errors
}

const updateToken = async (req, res) => {
  try {
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken || req.headers["x-refresh-token"]

    if (!refreshToken) {
      return res.status(401).json({ success: false, message: "Refresh token não fornecido", code: "MISSING_REFRESH_TOKEN" })
    }

    const newTokens = await refreshAccessToken(refreshToken)

    if (newTokens) {
      res.json({ success: true, data: newTokens })
    } else {
      res.status(401).json({ success: false, message: "Token inválido ou expirado", code: "INVALID_REFRESH_TOKEN" })
    }
  } catch (error) {
    console.error("Error refreshing tokens:", error)
    res.status(500).json({ success: false, message: "Erro interno do servidor" })
  }
}

const create = async (req, res) => {
  try {
    const { email, password, name, role = "admin" } = req.body

    const validationErrors = validateInput(req.body, ["email", "password"])
    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, message: "Dados inválidos", errors: validationErrors })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Formato de email inválido" })
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "A senha deve ter pelo menos 8 caracteres" })
    }

    const existing = await prisma.admin.findUnique({ where: { email } })
    if (existing) {
      return res.status(409).json({ success: false, message: "Email já está em uso." })
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const admin = await prisma.admin.create({
      data: { nome: name, email, senha: hashedPassword, role, status: "active" },
    })

    await logAdminAction(admin.id, "ADMIN_CREATED", { email, name, role })

    res.status(201).json({ success: true, message: "Administrador criado com sucesso.", data: { id: admin.id, email, name, role } })
  } catch (error) {
    console.error("Error creating admin:", error)
    res.status(500).json({ success: false, message: "Erro interno do servidor" })
  }
}

const login = async (req, res) => {
  try {
    const { email, password } = req.body

    const validationErrors = validateInput(req.body, ["email", "password"])
    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, message: "Email e senha são obrigatórios." })
    }

    const admin = await prisma.admin.findFirst({ where: { email, status: "active" } })

    if (!admin) {
      await logAdminAction(null, "LOGIN_FAILED", { email, reason: "user_not_found" })
      return res.status(401).json({ success: false, message: "Credenciais inválidas." })
    }

    const passwordIsValid = await bcrypt.compare(password, admin.senha)
    if (!passwordIsValid) {
      await logAdminAction(admin.id, "LOGIN_FAILED", { email, reason: "invalid_password" })
      return res.status(401).json({ success: false, message: "Credenciais inválidas." })
    }

    const { accessToken, refreshToken, accessTokenExpires, refreshTokenExpires } = generateTokens(admin.id, "admin")

    await prisma.admin.update({ where: { id: admin.id }, data: { updated_at: new Date() } })

    const existingToken = await prisma.adminToken.findFirst({ where: { adminId: admin.id } })
    if (existingToken) {
      await prisma.adminToken.update({
        where: { id: existingToken.id },
        data: { accessToken, refreshToken, accessTokenExpires, refreshTokenExpires },
      })
    } else {
      await prisma.adminToken.create({
        data: { adminId: admin.id, accessToken, refreshToken, accessTokenExpires, refreshTokenExpires },
      })
    }

    await logAdminAction(admin.id, "LOGIN_SUCCESS", { email })

    res.status(200).json({
      success: true,
      message: "Login realizado com sucesso.",
      data: {
        admin: { id: admin.id, email: admin.email, name: admin.nome, role: admin.role },
        tokens: { accessToken, refreshToken, accessTokenExpires, refreshTokenExpires },
      },
    })
  } catch (error) {
    console.error("Error processing login:", error)
    res.status(500).json({ success: false, message: "Erro interno do servidor" })
  }
}

const getDashboardStats = async (req, res) => {
  try {
    const adminId = req.admin.id

    const [totalNucleos, pendingNucleos, approvedNucleos, totalProjects, totalBlogPosts, recentNucleos] =
      await Promise.all([
        prisma.nucleo.count(),
        prisma.nucleo.count({ where: { status: "pending" } }),
        prisma.nucleo.count({ where: { status: "approved" } }),
        prisma.projeto.count(),
        prisma.blog.count(),
        prisma.nucleo.count({
          where: { created_at: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        }),
      ])

    await logAdminAction(adminId, "DASHBOARD_ACCESSED")

    res.json({ success: true, data: { totalNucleos, pendingNucleos, approvedNucleos, totalProjects, totalBlogPosts, recentNucleos } })
  } catch (error) {
    console.error("Error getting dashboard stats:", error)
    res.status(500).json({ success: false, message: "Erro ao buscar estatísticas do dashboard" })
  }
}

const getActivityLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, action } = req.query
    const skip = (page - 1) * limit

    const where = action ? { action } : {}

    const logs = await prisma.adminLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip: Number(skip),
      take: Number(limit),
      include: { admin: { select: { email: true, nome: true } } },
    })

    const formatted = logs.map((l) => ({
      ...l,
      adminEmail: l.admin?.email ?? null,
      adminName: l.admin?.nome ?? null,
    }))

    res.json({ success: true, data: { logs: formatted, pagination: { page: Number(page), limit: Number(limit), total: formatted.length } } })
  } catch (error) {
    console.error("Error in getActivityLogs:", error)
    res.status(500).json({ success: false, message: "Erro interno do servidor" })
  }
}

const updateNucleoStatus = async (req, res) => {
  try {
    const adminId = req.admin.id
    const nucleoId = Number(req.params.id)
    const { status, reason } = req.body

    const validStatuses = ["pending", "approved", "rejected"]
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Status inválido. Use: pending, approved, rejected" })
    }

    const nucleo = await prisma.nucleo.update({
      where: { id: nucleoId },
      data: { status },
    })

    await logAdminAction(adminId, "NUCLEO_STATUS_UPDATED", { nucleoId, newStatus: status, reason: reason || "No reason provided" })

    res.json({
      success: true,
      message: `Núcleo ${status === "approved" ? "aprovado" : status === "rejected" ? "reprovado" : "atualizado"} com sucesso`,
      data: { nucleoId, status },
    })
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, message: "Núcleo não encontrado" })
    }
    console.error("Error in updateNucleoStatus:", error)
    res.status(500).json({ success: false, message: "Erro interno do servidor" })
  }
}

module.exports = {
  create,
  login,
  updateToken,
  getDashboardStats,
  getActivityLogs,
  logAdminAction,
  getAllNucleos: GetAllNucleos,
  getNucleoById: GetNucleoById,
  updateNucleoStatus,
  createNucleo: CreateNucleo,
}
