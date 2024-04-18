const nodemailer = require('nodemailer');
require('dotenv').config();

async function enviarEmail(req,res){
  const { name, email, message } = req.body;
  
  if (!name || !email || !message) {
    return res.status(400).send({ error: 'Todos os campos são obrigatórios.' });
  }

  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_TRANSPORTER,
      pass: process.env.PASSWORD_TRANSPORTER,
    },
  });

  let mailOptions = {
    from: process.env.EMAIL_TRANSPORTER,
    to: process.env.CONTACT_EMAIL,
    subject: `Mensagem de ${name}`,
    text: `Você recebeu uma mensagem de ${email}: ${message}`,
  };

  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
      res.send('error');
    } else {
      console.log('Email enviado: ' + info.response);
      res.send('success');
    }
  });
}

module.exports= {enviarEmail}