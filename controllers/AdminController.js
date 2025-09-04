const bcrypt = require("bcrypt")
const connection = require("../connection")
const { generateTokens, refreshAccessToken, authenticateToken } = require("../middlewares/authFunctions")
const { GetAllNucleos, GetNucleoById, CreateNucleo } = require("./NucleosControllers")

const logAdminAction = (adminId, action, details = {}) => {
  const logSql = "INSERT INTO AdminLogs (adminId, action, details, timestamp) VALUES (?, ?, ?, NOW())"
  connection.query(logSql, [adminId, action, JSON.stringify(details)], (err) => {
    if (err) console.error("Error logging admin action:", err)
  })
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
    const refreshToken = req.body.refreshToken || req.cookies.refreshToken || req.headers["x-refresh-token"]

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token não fornecido",
        code: "MISSING_REFRESH_TOKEN",
      })
    }

    const newTokens = await refreshAccessToken(refreshToken)

    if (newTokens) {
      res.json({
        success: true,
        data: {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
          accessTokenExpires: newTokens.accessTokenExpires,
          refreshTokenExpires: newTokens.refreshTokenExpires,
        },
      })
    } else {
      res.status(401).json({
        success: false,
        message: "Token inválido ou expirado",
        code: "INVALID_REFRESH_TOKEN",
      })
    }
  } catch (error) {
    console.error("Error refreshing tokens:", error)
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      code: "INTERNAL_ERROR",
    })
  }
}

const create = async (req, res) => {
  try {
    const { email, password, name, role = "admin" } = req.body

    const validationErrors = validateInput(req.body, ["email", "password"])
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Dados inválidos",
        errors: validationErrors,
      })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Formato de email inválido",
      })
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "A senha deve ter pelo menos 8 caracteres",
      })
    }

    const checkEmail = `SELECT email FROM Admin WHERE email = ?`
    connection.query(checkEmail, [email], async (error, results) => {
      if (error) {
        console.error("Database error checking email:", error)
        return res.status(500).json({
          success: false,
          message: "Erro ao verificar email",
        })
      }

      if (results.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Email já está em uso.",
        })
      }

      const saltRounds = 12 // Increased security
      const hashedPassword = await bcrypt.hash(password, saltRounds)

      const sql = `INSERT INTO Admin (nome, email, senha, role, status, created_at) VALUES (?, ?, ?, ?, ?, NOW())`
      connection.query(sql, [name, email, hashedPassword, role, "active"], (error, results) => {
        if (error) {
          console.error("Database error creating admin:", error)
          return res.status(500).json({
            success: false,
            message: "Erro ao criar administrador",
          })
        }

        logAdminAction(results.insertId, "ADMIN_CREATED", { email, name, role })

        res.status(201).json({
          success: true,
          message: "Administrador criado com sucesso.",
          data: { id: results.insertId, email, name, role },
        })
      })
    })
  } catch (error) {
    console.error("Error creating admin:", error)
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
    })
  }
}

const login = async (req, res) => {
  try {
    const { email, password } = req.body

    const validationErrors = validateInput(req.body, ["email", "password"])
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email e senha são obrigatórios.",
      })
    }

    const sql = `SELECT * FROM Admin WHERE email = ? AND status = 'active'`
    connection.query(sql, [email], async (error, results) => {
      if (error) {
        console.error("Database error during login:", error)
        return res.status(500).json({
          success: false,
          message: "Erro ao buscar usuário",
        })
      }

      if (results.length === 0) {
        logAdminAction(null, "LOGIN_FAILED", { email, reason: "user_not_found" })
        return res.status(401).json({
          success: false,
          message: "Credenciais inválidas.",
        })
      }

      const admin = results[0]
      const passwordIsValid = await bcrypt.compare(password, admin.senha)

      if (!passwordIsValid) {
        logAdminAction(admin.id, "LOGIN_FAILED", { email, reason: "invalid_password" })
        return res.status(401).json({
          success: false,
          message: "Credenciais inválidas.",
        })
      }

      const { accessToken, refreshToken, accessTokenExpires, refreshTokenExpires } = generateTokens(admin.id, "admin")

      const updateLastLoginSql = "UPDATE Admin SET updated_at = NOW() WHERE id = ?"
      connection.query(updateLastLoginSql, [admin.id])

      const checkTokenSql = `SELECT * FROM AdminTokens WHERE adminId = ?`
      connection.query(checkTokenSql, [admin.id], (error, tokenResults) => {
        if (error) {
          console.error("Error checking existing tokens:", error)
          return res.status(500).json({
            success: false,
            message: "Erro ao verificar tokens existentes",
          })
        }

        let tokenSql
        if (tokenResults.length > 0) {
          tokenSql = `UPDATE AdminTokens SET accessToken = ?, refreshToken = ?, accessTokenExpires = ?, refreshTokenExpires = ?, updatedAt = NOW() WHERE adminId = ?`
        } else {
          tokenSql = `INSERT INTO AdminTokens (accessToken, refreshToken, accessTokenExpires, refreshTokenExpires, adminId, createdAt) VALUES (?, ?, ?, ?, ?, NOW())`
        }

        connection.query(
          tokenSql,
          [accessToken, refreshToken, accessTokenExpires, refreshTokenExpires, admin.id],
          (error) => {
            if (error) {
              console.error("Error saving tokens:", error)
              return res.status(500).json({
                success: false,
                message: "Erro ao salvar os tokens no banco de dados",
              })
            }

            logAdminAction(admin.id, "LOGIN_SUCCESS", { email })

            res.status(200).json({
              success: true,
              message: "Login realizado com sucesso.",
              data: {
                admin: {
                  id: admin.id,
                  email: admin.email,
                  name: admin.nome,
                  role: admin.role,
                },
                tokens: {
                  accessToken,
                  refreshToken,
                  accessTokenExpires,
                  refreshTokenExpires,
                },
              },
            })
          },
        )
      })
    })
  } catch (error) {
    console.error("Error processing login:", error)
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
    })
  }
}

const getDashboardStats = async (req, res) => {
  try {
    const adminId = req.admin.id

    const statsQueries = [
      "SELECT COUNT(*) as totalNucleos FROM Nucleo",
      'SELECT COUNT(*) as pendingNucleos FROM Nucleo WHERE status = "pending"',
      'SELECT COUNT(*) as approvedNucleos FROM Nucleo WHERE status = "approved"',
      "SELECT COUNT(*) as totalProjects FROM Projetos",
      "SELECT COUNT(*) as totalBlogPosts FROM Blog",
      "SELECT COUNT(*) as recentNucleos FROM Nucleo WHERE DATE(createdAt) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)",
    ]

    const results = await Promise.all(
      statsQueries.map(
        (query) =>
          new Promise((resolve, reject) => {
            connection.query(query, (error, results) => {
              if (error) reject(error)
              else resolve(results[0])
            })
          }),
      ),
    )

    logAdminAction(adminId, "DASHBOARD_ACCESSED")

    res.json({
      success: true,
      data: {
        totalNucleos: results[0].totalNucleos,
        pendingNucleos: results[1].pendingNucleos,
        approvedNucleos: results[2].approvedNucleos,
        totalProjects: results[3].totalProjects,
        totalBlogPosts: results[4].totalBlogPosts,
        recentNucleos: results[5].recentNucleos,
      },
    })
  } catch (error) {
    console.error("Error getting dashboard stats:", error)
    res.status(500).json({
      success: false,
      message: "Erro ao buscar estatísticas do dashboard",
    })
  }
}

const getActivityLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, action } = req.query
    const offset = (page - 1) * limit

    let whereClause = ""
    const queryParams = []

    if (action) {
      whereClause = "WHERE action = ?"
      queryParams.push(action)
    }

    const sql = `
      SELECT al.*, a.email as adminEmail, a.name as adminName 
      FROM AdminLogs al 
      LEFT JOIN Admin a ON al.adminId = a.id 
      ${whereClause}
      ORDER BY al.timestamp DESC 
      LIMIT ? OFFSET ?
    `

    queryParams.push(Number.parseInt(limit), Number.parseInt(offset))

    connection.query(sql, queryParams, (error, results) => {
      if (error) {
        console.error("Error fetching activity logs:", error)
        return res.status(500).json({
          success: false,
          message: "Erro ao buscar logs de atividade",
        })
      }

      res.json({
        success: true,
        data: {
          logs: results,
          pagination: {
            page: Number.parseInt(page),
            limit: Number.parseInt(limit),
            total: results.length,
          },
        },
      })
    })
  } catch (error) {
    console.error("Error in getActivityLogs:", error)
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
    })
  }
}

const updateNucleoStatus = async (req, res) => {
  try {
    const adminId = req.admin.id
    const nucleoId = req.params.id
    const { status, reason } = req.body

    const validStatuses = ["pending", "approved", "rejected"]
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status inválido. Use: pending, approved, rejected",
      })
    }

    const sql = `UPDATE Nucleo SET status = ?, updated_at = NOW() WHERE ID = ?`

    connection.query(sql, [status, nucleoId], (error, results) => {
      if (error) {
        console.error("Error updating nucleo status:", error)
        return res.status(500).json({
          success: false,
          message: "Erro ao atualizar status do núcleo",
        })
      }

      if (results.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "Núcleo não encontrado",
        })
      }

      logAdminAction(adminId, "NUCLEO_STATUS_UPDATED", {
        nucleoId,
        newStatus: status,
        reason: reason || "No reason provided",
      })

      res.json({
        success: true,
        message: `Núcleo ${status === "approved" ? "aprovado" : status === "rejected" ? "reprovado" : "atualizado"} com sucesso`,
        data: { nucleoId, status },
      })
    })
  } catch (error) {
    console.error("Error in updateNucleoStatus:", error)
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
    })
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
