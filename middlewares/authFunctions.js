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

    if (type === "admin") {
      await prisma.adminToken.updateMany({
        where: { adminId: userId },
        data: { accessToken, refreshToken: newRefreshToken, accessTokenExpires, refreshTokenExpires },
      })
    } else {
      await prisma.nucleoToken.updateMany({
        where: { nucleoId: userId },
        data: { accessToken, refreshToken: newRefreshToken, accessTokenExpires, refreshTokenExpires },
      })
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

module.exports = { generateTokens, refreshAccessToken, authenticateAdmin, authenticateNucleo }
