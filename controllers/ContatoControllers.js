const nodemailer = require("nodemailer")
const prisma = require("../lib/prismaClient")
const { normalizeEmail } = require("../lib/email")
const { confirmacaoContato, confirmacaoNovidades } = require("../lib/emailLayout")
require("dotenv").config()

/** A home envia este nome fixo no "Receba novidades" (Home/index.jsx). */
const NOME_NOVIDADES = "Receba Novidades"

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

  // Destino definido pela organizacao (Roberto, 20/08/2026): tanto o formulario
  // de Contato quanto o "Receba novidades" da home vao para contato@ — os dois
  // caem neste endpoint, por isso um unico destino resolve ambos.
  const destinoEquipe = process.env.EMAIL_CONTATO || "contato@esf.org.br"

  const mailOptions = {
    from: process.env.EMAIL_TRANSPORTER,
    to: destinoEquipe,
    replyTo: email,
    subject: assunto ? `Contato: ${assunto} — ${name}` : `Mensagem de ${name}`,
    text: `Você recebeu uma nova mensagem de ${name}

E-mail: ${email}
${telefone ? `Telefone: ${telefone}\n` : ""}${assunto ? `Assunto: ${assunto}\n` : ""}
Mensagem:
${message}

------------------
Para responder a quem escreveu, use o "Responder" deste e-mail.`,
  }

  // Confirmacao para quem preencheu o formulario. Antes so a equipe era avisada
  // e a pessoa ficava sem saber se a mensagem tinha chegado. Vai fora do caminho
  // da resposta: falha aqui nao pode derrubar o envio principal.
  const confirmacao =
    String(name).trim() === NOME_NOVIDADES
      ? confirmacaoNovidades()
      : confirmacaoContato({ nome: name, mensagem: message, assunto })

  transporter
    .sendMail({
      from: process.env.EMAIL_TRANSPORTER,
      to: email,
      // Se a pessoa responder a confirmacao, cai na caixa da equipe.
      replyTo: destinoEquipe,
      subject: confirmacao.subject,
      text: confirmacao.text,
      html: confirmacao.html,
    })
    .then(() => console.log(`[contato] Confirmacao enviada para ${email}`))
    .catch((error) => console.error("[contato] Falha ao enviar confirmacao:", error.message))

  try {
    const info = await transporter.sendMail(mailOptions)
    // Inclui o destinatario: sem isso, investigar "nao chegou" exigia deduzir o
    // destino a partir da ordem das linhas do log.
    console.log(`Email enviado para ${destinoEquipe}: ${info.response}`)
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
