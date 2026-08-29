const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const nodemailer = require("nodemailer")
const prisma = require("../lib/prismaClient")
const { normalizeEmail, emailWhereInsensitive } = require("../lib/email")
const { validarSenha, REGRA_SENHA } = require("../lib/password")
const { deriveSecret } = require("../lib/resetLink")
const { recuperacaoSenha } = require("../lib/emailLayout")
require("dotenv").config()

// URL do front (onde fica a página /redefinir-senha). Sem barra final.
const FRONTEND_URL = String(process.env.FRONTEND_URL || "https://esf.org.br").replace(/\/+$/, "")

const RESET_TOKEN_TTL = "1h"

// `deriveSecret` vive em lib/resetLink.js: o convite de membro emite o mesmo
// tipo de token, e duplicar a derivação faria os dois fluxos divergirem.

function buildTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_TRANSPORTER, pass: process.env.PASSWORD_TRANSPORTER },
  })
}

/** Busca a conta (admin tem prioridade) pelo e-mail, ignorando maiúsculas/minúsculas. */
async function findAccountByEmail(email) {
  const admin = await prisma.admin.findFirst({
    where: { email: emailWhereInsensitive(email) },
    orderBy: { id: "asc" },
  })
  if (admin) return { type: "admin", record: admin }

  const nucleo = await prisma.nucleo.findFirst({
    where: { Email: emailWhereInsensitive(email) },
    orderBy: { id: "asc" },
  })
  if (nucleo) return { type: "nucleo", record: nucleo }

  const membro = await prisma.nucleoMembro.findFirst({
    where: { email: emailWhereInsensitive(email) },
  })
  if (membro) return { type: "membro", record: membro }

  return null
}

function getHash(type, record) {
  if (type === "admin") return record.senha
  // Membro usa `senha` minúsculo e pode estar nulo (convite ainda não aceito).
  if (type === "membro") return record.senha
  return record.Senha
}

function getName(type, record) {
  if (type === "admin") return record.nome
  if (type === "membro") return record.nome
  return record.Nome
}

/**
 * POST /auth/forgot-password  { email }
 * Sempre responde 200 (não revela se o e-mail existe). Se existir, envia o link.
 */
const requestReset = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email || "")

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Informe um e-mail válido" })
    }

    const account = await findAccountByEmail(email)

    // Resposta genérica para não vazar quais e-mails estão cadastrados.
    const genericOk = () =>
      res.status(200).json({
        success: true,
        message: "Se o e-mail estiver cadastrado, enviaremos um link de redefinição de senha.",
      })

    if (!account) return genericOk()

    const { type, record } = account
    const secret = deriveSecret(type, getHash(type, record))
    const token = jwt.sign({ id: record.id, type }, secret, { expiresIn: RESET_TOKEN_TTL })

    const link = `${FRONTEND_URL}/redefinir-senha?token=${encodeURIComponent(token)}`

    if (!process.env.EMAIL_TRANSPORTER || !process.env.PASSWORD_TRANSPORTER) {
      // Sem SMTP configurado: loga o link para não travar o fluxo em dev.
      console.warn("[passwordReset] SMTP não configurado — link de reset:", link)
      return genericOk()
    }

    const conteudo = recuperacaoSenha({ nome: getName(type, record), link })

    const mailOptions = {
      from: process.env.EMAIL_TRANSPORTER,
      to: email,
      subject: conteudo.subject,
      text: conteudo.text,
      html: conteudo.html,
    }

    // Envia fora do caminho da resposta: não bloqueia o cliente esperando o SMTP.
    buildTransporter()
      .sendMail(mailOptions)
      .catch((err) => console.error("[passwordReset] Falha ao enviar e-mail:", err.message))

    return genericOk()
  } catch (error) {
    console.error("Error in requestReset:", error)
    return res.status(500).json({ success: false, message: "Erro interno do servidor" })
  }
}

/**
 * POST /auth/reset-password  { token, novaSenha }
 * Valida o token (assinado com segredo derivado do hash atual) e troca a senha.
 */
const resetPassword = async (req, res) => {
  try {
    const { token, novaSenha } = req.body || {}

    if (!token || !novaSenha) {
      return res.status(400).json({ success: false, message: "Token e nova senha são obrigatórios" })
    }

    const errosSenha = validarSenha(novaSenha)
    if (errosSenha.length > 0) {
      return res.status(400).json({ success: false, message: REGRA_SENHA, errors: errosSenha })
    }

    // Lê id/type sem verificar assinatura (o segredo depende do hash atual do usuário).
    let decoded
    try {
      decoded = jwt.decode(token)
    } catch {
      decoded = null
    }
    if (!decoded || !decoded.id || !decoded.type) {
      return res.status(400).json({ success: false, message: "Token inválido" })
    }

    const { id, type } = decoded

    let record
    if (type === "admin") {
      record = await prisma.admin.findUnique({ where: { id: Number(id) } })
    } else if (type === "nucleo") {
      record = await prisma.nucleo.findUnique({ where: { id: Number(id) } })
    } else if (type === "membro") {
      record = await prisma.nucleoMembro.findUnique({ where: { id: Number(id) } })
    }

    if (!record) {
      return res.status(400).json({ success: false, message: "Token inválido ou expirado" })
    }

    const secret = deriveSecret(type, getHash(type, record))
    try {
      jwt.verify(token, secret)
    } catch {
      return res.status(400).json({ success: false, message: "Link inválido ou expirado. Solicite um novo." })
    }

    const hashedPassword = await bcrypt.hash(String(novaSenha), 12)

    if (type === "admin") {
      await prisma.$transaction([
        prisma.admin.update({ where: { id: record.id }, data: { senha: hashedPassword } }),
        // Invalida sessões ativas: força novo login com a senha nova.
        prisma.adminToken.deleteMany({ where: { adminId: record.id } }),
      ])
    } else if (type === "membro") {
      // Mesma rota atende o convite: aqui o membro sai de senha nula para ativo.
      await prisma.$transaction([
        prisma.nucleoMembro.update({ where: { id: record.id }, data: { senha: hashedPassword } }),
        prisma.membroToken.deleteMany({ where: { membroId: record.id } }),
      ])
    } else {
      await prisma.$transaction([
        prisma.nucleo.update({ where: { id: record.id }, data: { Senha: hashedPassword } }),
        prisma.nucleoToken.deleteMany({ where: { nucleoId: record.id } }),
      ])
    }

    return res.status(200).json({ success: true, message: "Senha redefinida com sucesso. Faça login com a nova senha." })
  } catch (error) {
    console.error("Error in resetPassword:", error)
    return res.status(500).json({ success: false, message: "Erro interno do servidor" })
  }
}

module.exports = { requestReset, resetPassword }
