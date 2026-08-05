const nodemailer = require("nodemailer")
const prisma = require("../lib/prismaClient")
const { normalizeEmail } = require("../lib/email")
require("dotenv").config()

async function enviarEmail(req, res) {
  const { name, email, message, telefone, assunto } = req.body

  if (!name || !email || !message) {
    return res.status(400).send({ error: "Todos os campos são obrigatórios." })
  }

  // Grava ANTES de enviar: o e-mail era o único destino da mensagem, então uma
  // falha de SMTP fazia o contato do usuário se perder sem nenhum registro.
  // A tabela ContatoMessage já existia no schema, mas nada escrevia nela.
  let registro = null
  try {
    registro = await prisma.contatoMessage.create({
      data: {
        nome: String(name).trim(),
        email: normalizeEmail(email),
        telefone: telefone ? String(telefone).trim() : null,
        assunto: assunto ? String(assunto).trim() : null,
        mensagem: String(message).trim(),
        status: "new",
      },
    })
  } catch (error) {
    console.error("[contato] Falha ao gravar mensagem no banco:", error.message)
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_TRANSPORTER,
      pass: process.env.PASSWORD_TRANSPORTER,
    },
  })

  const mailOptions = {
    from: process.env.EMAIL_TRANSPORTER,
    to: process.env.FINAL_EMAIL,
    replyTo: email,
    subject: assunto ? `Contato: ${assunto} — ${name}` : `Mensagem de ${name}`,
    text: `Você recebeu uma nova mensagem de ${name}

E-mail: ${email}
${telefone ? `Telefone: ${telefone}\n` : ""}${assunto ? `Assunto: ${assunto}\n` : ""}
Mensagem:
${message}

------------------
Por favor, não responda a este e-mail.`,
  }

  try {
    const info = await transporter.sendMail(mailOptions)
    console.log("Email enviado: " + info.response)
    return res.status(200).json({ success: true, message: "Email enviado com sucesso" })
  } catch (error) {
    console.error("[contato] Falha ao enviar e-mail:", error.message)

    // A mensagem está salva: para o usuário, o contato foi recebido.
    if (registro) {
      return res.status(200).json({
        success: true,
        message: "Mensagem recebida com sucesso",
      })
    }

    return res.status(500).json({ success: false, message: "Erro ao enviar email", error: error.message })
  }
}

module.exports = { enviarEmail }
