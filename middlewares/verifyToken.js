require("dotenv").config()
const jwt = require("jsonwebtoken")

const tokenSecret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET

const verificarToken = (req, res, next) => {
  const headerAuth = req.headers.authorization

  if (!headerAuth || !headerAuth.startsWith("Bearer")) {
    return res.status(401).send("Acesso negado!")
  }

  const token = headerAuth.split(" ")[1]

  try {
    const tokenVerificado = jwt.verify(token, tokenSecret)
    req.usuario = tokenVerificado
    next()
  } catch (error) {
    return res.status(401).send("Chave de autenticação da API inválida")
  }
}

module.exports = verificarToken
