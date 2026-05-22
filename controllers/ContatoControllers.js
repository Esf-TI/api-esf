const nodemailer = require("nodemailer");
require("dotenv").config();

async function enviarEmail(req, res) {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).send({ error: "Todos os campos são obrigatórios." });
  }

  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_TRANSPORTER,
      pass: process.env.PASSWORD_TRANSPORTER,
    },
  });

  let mailOptions = {
    from: process.env.EMAIL_TRANSPORTER,
    to: process.env.FINAL_EMAIL,
    subject: `Mensagem de ${name}`,
    text: `
Você recebeu uma nova mensagem de ${name} 

email: (${email}):
  
Mensagem: ${message}

------------------
Por favor, não responda a este e-mail.
      `,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
      return res.status(500).json({
        success: false,
        message: "Erro ao enviar email",
        error: error.message
      });
    } else {
      console.log("Email enviado: " + info.response);
      res.status(200).json({
        success: true,
        message: "Email enviado com sucesso"
      });
    }
  });
}

module.exports = { enviarEmail };
