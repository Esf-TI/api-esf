const jwt = require("jsonwebtoken")
require("dotenv").config()
const moment = require("moment")
const prisma = require("../lib/prismaClient")

const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET
const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET

function generateTokens(userId, type) {
  const payload = { userId, type }
  const accessTokenExpiresIn = "1d"
  const refreshTokenExpiresIn = "7d"

  const accessToken = jwt.sign(payload, accessTokenSecret, { expiresIn: accessTokenExpiresIn })
  const refreshToken = jwt.sign(payload, refreshTokenSecret, { expiresIn: refreshTokenExpiresIn })

  const accessTokenExpires = moment().add(1, "days").toDate()
  const refreshTokenExpires = moment().add(7, "days").toDate()

  return { accessToken, refreshToken, accessTokenExpires, refreshTokenExpires }
}

async function refreshAccessToken(refreshToken) {
  try {
    const decoded = jwt.verify(refreshToken, refreshTokenSecret)
    const { userId, type } = decoded

    const accessToken = jwt.sign({ userId, type }, accessTokenSecret, { expiresIn: "1d" })
    const newRefreshToken = jwt.sign({ userId, type }, refreshTokenSecret, { expiresIn: "7d" })

    const accessTokenExpires = new Date(Date.now() + 86400000)
    const refreshTokenExpires = new Date(Date.now() + 604800000)

    const dados = { accessToken, refreshToken: newRefreshToken, accessTokenExpires, refreshTokenExpires }

    // Despacho explicito por tipo: o `else` generico mandava qualquer tipo
    // desconhecido para nucleoToken, o que quebraria ao surgir um terceiro ator.
    if (type === "admin") {
      await prisma.adminToken.updateMany({ where: { adminId: userId }, data: dados })
    } else if (type === "membro") {
      await prisma.membroToken.updateMany({ where: { membroId: userId }, data: dados })
    } else {
      await prisma.nucleoToken.updateMany({ where: { nucleoId: userId }, data: dados })
    }

    return { accessToken, refreshToken: newRefreshToken, accessTokenExpires, refreshTokenExpires }
  } catch (error) {
    console.error("Error refreshing tokens:", error)
    return null
  }
}

function authenticateAdmin(req, res, next) {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ message: "Token não fornecido" })
  }

  jwt.verify(token, accessTokenSecret, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Token inválido ou expirado" })
    }

    try {
      const tokenRecord = await prisma.adminToken.findFirst({ where: { accessToken: token } })
      if (!tokenRecord) {
        return res.status(403).json({ message: "Token não autorizado para esta ação" })
      }

      req.admin = { id: decoded.userId, type: decoded.type }
      req.user = decoded
      next()
    } catch (error) {
      return res.status(500).json({ message: "Erro ao validar o token" })
    }
  })
}

function authenticateNucleo(req, res, next) {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ message: "Token não fornecido" })
  }

  jwt.verify(token, accessTokenSecret, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Token inválido ou expirado" })
    }

    try {
      const tokenRecord = await prisma.nucleoToken.findFirst({ where: { accessToken: token } })
      if (!tokenRecord) {
        return res.status(403).json({ message: "Token não autorizado para esta ação" })
      }

      req.nucleo = { id: decoded.userId, type: decoded.type }
      req.user = decoded
      next()
    } catch (error) {
      return res.status(500).json({ message: "Erro ao validar o token" })
    }
  })
}

/**
 * Aceita admin OU núcleo. Popula `req.admin` ou `req.nucleo` conforme o tipo do
 * token, para o handler decidir o nível de acesso.
 */
function authenticateAdminOrNucleo(req, res, next) {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ message: "Token não fornecido" })
  }

  jwt.verify(token, accessTokenSecret, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Token inválido ou expirado" })
    }

    try {
      if (decoded.type === "admin") {
        const tokenRecord = await prisma.adminToken.findFirst({ where: { accessToken: token } })
        if (!tokenRecord) return res.status(403).json({ message: "Token não autorizado para esta ação" })
        req.admin = { id: decoded.userId, type: decoded.type }
      } else if (decoded.type === "membro") {
        // Membro nao gerencia o nucleo: recusa com mensagem clara em vez de
        // cair na busca por nucleoToken e devolver um 403 generico.
        return res.status(403).json({ message: "Esta ação é restrita ao núcleo" })
      } else {
        const tokenRecord = await prisma.nucleoToken.findFirst({ where: { accessToken: token } })
        if (!tokenRecord) return res.status(403).json({ message: "Token não autorizado para esta ação" })
        req.nucleo = { id: decoded.userId, type: decoded.type }
      }

      req.user = decoded
      next()
    } catch (error) {
      return res.status(500).json({ message: "Erro ao validar o token" })
    }
  })
}

/**
 * Impede que um núcleo altere os dados de OUTRO núcleo (IDOR): o alvo vem de
 * `req.params.id`, então sem esta checagem qualquer núcleo logado editava
 * qualquer outro. Admin passa direto (modera todos).
 */
function ensureNucleoSelf(req, res, next) {
  if (req.admin) return next()

  const targetId = Number(req.params.id)
  if (!req.nucleo || !Number.isFinite(targetId) || req.nucleo.id !== targetId) {
    return res.status(403).json({ success: false, message: "Você só pode alterar os dados do seu próprio núcleo" })
  }

  next()
}

/**
 * Garante que o projeto alvo pertence ao núcleo autenticado. Admin passa direto.
 */
async function ensureProjetoDoNucleo(req, res, next) {
  if (req.admin) return next()

  const projetoId = Number(req.params.id)
  if (!Number.isFinite(projetoId)) {
    return res.status(400).json({ success: false, message: "ID de projeto inválido" })
  }

  try {
    const projeto = await prisma.projeto.findUnique({
      where: { id: projetoId },
      select: { NucleoResponsavel: true },
    })

    if (!projeto) return res.status(404).json({ success: false, message: "Projeto não encontrado" })

    if (!req.nucleo || projeto.NucleoResponsavel !== req.nucleo.id) {
      return res.status(403).json({ success: false, message: "Este projeto pertence a outro núcleo" })
    }

    next()
  } catch (error) {
    console.error("Erro ao validar posse do projeto:", error)
    return res.status(500).json({ success: false, message: "Erro ao validar acesso ao projeto" })
  }
}

/**
 * Autentica um membro de nucleo (terceiro ator, ao lado de admin e nucleo).
 */
function authenticateMembro(req, res, next) {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ message: "Token não fornecido" })
  }

  jwt.verify(token, accessTokenSecret, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Token inválido ou expirado" })
    }

    if (decoded.type !== "membro") {
      return res.status(403).json({ message: "Token não é de um membro" })
    }

    try {
      const tokenRecord = await prisma.membroToken.findFirst({ where: { accessToken: token } })
      if (!tokenRecord) {
        return res.status(403).json({ message: "Token não autorizado para esta ação" })
      }

      req.membro = { id: decoded.userId, type: decoded.type }
      req.user = decoded
      next()
    } catch (error) {
      return res.status(500).json({ message: "Erro ao validar o token" })
    }
  })
}

/**
 * Garante que o membro alvo pertence ao nucleo autenticado — mesmo papel que
 * `ensureProjetoDoNucleo` faz para projetos. Admin passa direto.
 */
async function ensureMembroDoNucleo(req, res, next) {
  if (req.admin) return next()

  const membroId = Number(req.params.id)
  if (!Number.isFinite(membroId)) {
    return res.status(400).json({ success: false, message: "ID de membro inválido" })
  }

  try {
    const membro = await prisma.nucleoMembro.findUnique({
      where: { id: membroId },
      select: { nucleoId: true },
    })

    if (!membro) return res.status(404).json({ success: false, message: "Membro não encontrado" })

    if (!req.nucleo || membro.nucleoId !== req.nucleo.id) {
      return res.status(403).json({ success: false, message: "Este membro pertence a outro núcleo" })
    }

    next()
  } catch (error) {
    console.error("Erro ao validar posse do membro:", error)
    return res.status(500).json({ success: false, message: "Erro ao validar acesso ao membro" })
  }
}

module.exports = {
  generateTokens,
  refreshAccessToken,
  authenticateAdmin,
  authenticateNucleo,
  authenticateAdminOrNucleo,
  authenticateMembro,
  ensureNucleoSelf,
  ensureProjetoDoNucleo,
  ensureMembroDoNucleo,
}
