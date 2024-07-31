const connection = require('../connection');
const BUCKET = 'engenheiros-sem-fronteiras.appspot.com'
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { generateTokens, refreshAccessToken, authenticateToken } = require('../middlewares/authFunctions');
const { createSubdomain } = require('../middlewares/domainFunctions');
require('dotenv').config();

const tokenSecret = process.env.JWT_SECRET;

const deleteNucleo = async (req, res) => {
  const { id } = req.params;  // ID do núcleo a ser deletado, assumindo que é passado na URL

  if (!id) {
    return res.status(400).send('ID do núcleo não fornecido');
  }

  try {
    const deleteQuery = 'DELETE FROM Nucleo WHERE ID = ?';
    connection.query(deleteQuery, [id], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Erro ao deletar o núcleo');
      }
      if (result.affectedRows === 0) {
        return res.status(404).send('Núcleo não encontrado');
      }
      return res.status(200).send('Núcleo deletado com sucesso');
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send('Erro ao tentar deletar o núcleo');
  }
};

const CreateNucleo = async (req, res) => {
  const { email, senha, nomeNucleo, descricao, cidade, dataFundacao, linkDoacao, linkSite, linkLinkedin, linkFacebook, linkInstagram } = req.body;
  const upload = req.file
  // Verificação se todos os campos estão preenchidos
  if (!email || !senha || !nomeNucleo || !descricao || !cidade || !dataFundacao || !linkDoacao || !linkSite || !linkLinkedin || !linkFacebook || !linkInstagram) {
    return res.status(400).send('Por favor, preencha todos os campos');
  }

  // Assegurar que a imagem foi enviada corretamente
  if (!upload || !upload.filename) {
    res.status(400).send('Imagem não foi enviada corretamente');
    return;
  }

  const image = `https://storage.googleapis.com/${BUCKET}/${upload.filename}`;

  try {
    // Geração do hash da senha
    const hashedPassword = await bcrypt.hash(senha, 10); // O segundo argumento é o "salt rounds"

    const inserirNucleo = 'INSERT INTO Nucleo (Nome, Email, Senha, Cidade, Descricao, DataFundacao, fotoCapa, linkDoacao, linkSite, linkLinkedin, linkFacebook, linkInstagram, status, subdominio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    connection.query(inserirNucleo, [nomeNucleo, email, hashedPassword, cidade, descricao, dataFundacao, image, linkDoacao, linkSite, linkLinkedin, linkFacebook, linkInstagram, "pending", null], async (err, result) => {
      if (err) {
        console.log(err);
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).send('E-mail já cadastrado'); // Ou a mensagem que preferir
        }
        return res.status(500).send('Erro ao criar o núcleo');
      }
      const nucleoId = result.insertId;
      return res.status(200).send({ id: nucleoId, message:"Núcleo criado com sucesso!"});
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send('Erro ao criar o núcleo');
  }
};

const LoginNucleo = async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).send('Por favor, forneça o email e a senha');
  }

  try {
    const buscarNucleo = 'SELECT * FROM Nucleo WHERE Email = ?';
    connection.query(buscarNucleo, [email], async (err, results) => {
      if (err) {
        console.error('Erro ao tentar fazer o login:', err);
        return res.status(500).send('Erro ao tentar fazer o login');
      }

      if (results.length === 0) {
        return res.status(404).send('Usuário não encontrado');
      }

      const nucleo = results[0];
      const senhaCorrespondente = await bcrypt.compare(senha, nucleo.Senha);
      if (!senhaCorrespondente) {
        return res.status(401).send('Senha incorreta');
      }

      if(nucleo.status != 'approved'){
        return res.status(409).send("Nucleo nao aprovado")
      }

      const tokens = generateTokens(nucleo.ID,"nucleo");

      const limparTokensSql = 'DELETE FROM NucleoTokens WHERE nucleoId = ?';
      connection.query(limparTokensSql, [nucleo.ID], (err, deleteResult) => {
        if (err) {
          console.error('Erro ao limpar tokens antigos:', err);
          return res.status(500).send('Erro ao atualizar tokens');
        }

        const insertTokensSql = 'INSERT INTO NucleoTokens (nucleoId, accessToken, refreshToken, accessTokenExpires, refreshTokenExpires) VALUES (?, ?, ?, ?, ?)';
        connection.query(insertTokensSql, [nucleo.ID, tokens.accessToken, tokens.refreshToken, tokens.accessTokenExpires, tokens.refreshTokenExpires], (err, insertResult) => {
          if (err) {
            console.error('Erro ao inserir novos tokens:', err);
            return res.status(500).send('Erro ao salvar os tokens no banco de dados');
          }

          res.status(200).json({
            message: 'Login realizado com sucesso.',
            id: nucleo.ID,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            accessTokenExpires: tokens.accessTokenExpires,
            refreshTokenExpires: tokens.refreshTokenExpires
          });
        });
      });
    });
  } catch (error) {
    console.error('Erro ao tentar fazer o login:', error);
    return res.status(500).send('Erro ao tentar fazer o login');
  }
};
const GetAllNucleos = async (req, res) => {
  try {
    const buscarTodosNucleos = 'SELECT * FROM Nucleo';
    connection.query(buscarTodosNucleos, async (err, results) => {
      if (err) {
        console.log(err);
        return res.status(500).send('Erro ao buscar os núcleos');
      }
      return res.status(200).json(results);
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send('Erro ao buscar os núcleos');
  }
};

const getApprovedNucleos = (req, res) => {
  // Consulta SQL para buscar os núcleos aprovados
  const sql = 'SELECT * FROM Nucleo WHERE status = ?';

  // Valor a ser comparado com o campo "status"
  const statusAprovado = 'approved';

  connection.query(sql, [statusAprovado], (error, results) => {
    if (error) {
      console.error('Erro ao buscar núcleos aprovados: ' + error.message);
      res.status(500).send('Erro ao buscar núcleos aprovados');
      return;
    }

    // Se não houver resultados, significa que nenhum núcleo foi encontrado com status "approved"
    if (results.length === 0) {
      res.status(404).send('Nenhum núcleo aprovado encontrado');
      return;
    }

    // Se houver resultados, retorna os núcleos encontrados
    res.status(200).json(results);
  });
};

const GetNucleoById = async (req, res) => {
  const nucleoId = req.params.id;

  try {
    const buscarNucleoPorId = 'SELECT * FROM Nucleo WHERE ID = ?';
    connection.query(buscarNucleoPorId, [nucleoId], async (err, results) => {
      if (err) {
        console.log(err);
        return res.status(500).send('Erro ao buscar o núcleo');
      }

      if (results.length === 0) {
        return res.status(404).send('Núcleo não encontrado');
      }

      return res.status(200).json(results[0]);
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send('Erro ao buscar o núcleo');
  }
};


const updateNucleoStatus = (req, res) => {
  const nucleoId = req.params.id;
  const { novoStatus } = req.body;

  // Verificar se o ID do núcleo e o novo status foram fornecidos
  if (!nucleoId || !novoStatus) {
    res.status(400).send('O ID do núcleo e o novo status são obrigatórios');
    return;
  }

  // Verificar se o novo status é válido
  if (novoStatus !== 'approved' && novoStatus !== 'reproved') {
    res.status(400).send('O novo status deve ser "approved" ou "reproved"');
    return;
  }

  // Obter o nome do núcleo com base no nucleoId
  const getNucleoNomeQuery = 'SELECT Nome, subdominio FROM Nucleo WHERE ID = ?';
  connection.query(getNucleoNomeQuery, [nucleoId], (error, results) => {
    if (error) {
      console.error('Erro ao obter nome do núcleo: ' + error.message);
      res.status(500).send('Erro ao obter nome do núcleo');
      return;
    }

    if (results.length === 0) {
      res.status(404).send('Núcleo não encontrado');
      return;
    }

    const nucleoNome = results[0].Nome;
    const subdominio = results[0].subdominio;

    // Atualizar o status do núcleo no banco de dados
    const updateStatusQuery = 'UPDATE Nucleo SET status = ? WHERE ID = ?';
    connection.query(updateStatusQuery, [novoStatus, nucleoId], async (error, results) => {
      if (error) {
        console.error('Erro ao atualizar status do núcleo: ' + error.message);
        res.status(500).send('Erro ao atualizar status do núcleo');
        return;
      }

      // Verificar se algum núcleo foi atualizado
      if (results.affectedRows === 0) {
        res.status(404).send('Núcleo não encontrado');
        return;
      }

      console.log(`Status do núcleo ${nucleoNome} atualizado para ${novoStatus}`);

      // Verificar se o campo subdominio é null
      if (novoStatus === 'approved' && subdominio === null) {
        try {
          const newSubdomain = nucleoNome.replace(/\s+/g, '').toLowerCase(); // Exemplo de como criar o subdomínio a partir do nome do núcleo
          await createSubdomain(newSubdomain);

          // Atualizar o campo subdominio no banco de dados
          const updateSubdomainQuery = 'UPDATE Nucleo SET subdominio = ? WHERE ID = ?';
          connection.query(updateSubdomainQuery, [newSubdomain, nucleoId], (error, results) => {
            if (error) {
              console.error('Erro ao atualizar subdomínio do núcleo: ' + error.message);
              res.status(500).send('Erro ao atualizar subdomínio do núcleo');
              return;
            }

            console.log(`Subdomínio do núcleo ${nucleoNome} atualizado para ${newSubdomain}`);
            res.status(200).send(`Status do núcleo ${nucleoNome} atualizado para ${novoStatus} e subdomínio criado como ${newSubdomain}`);
          });
        } catch (error) {
          console.error('Erro ao criar subdomínio:', error.message);
          res.status(500).send('Erro ao criar subdomínio');
        }
      } else {
        res.status(200).send(`Status do núcleo ${nucleoNome} atualizado para ${novoStatus}`);
      }
    });
  });
};

const patchNucleo = (req, res) => {
  const nucleoId = req.params.id; // Obtenha o ID do núcleo a ser editado
  const { campoAAlterar, novoValor } = req.body;

  // Verificar se todos os campos obrigatórios estão presentes
  if (!nucleoId || !campoAAlterar || !novoValor) {
    res.status(400).send('O ID do núcleo, o campo a ser alterado e o novo valor são obrigatórios');
    return;
  }

  // Verificar se o núcleo com o ID fornecido existe no banco de dados
  const checkNucleoQuery = 'SELECT * FROM Nucleo WHERE ID = ?';
  connection.query(checkNucleoQuery, [nucleoId], (error, results) => {
    if (error) {
      console.error('Erro ao verificar núcleo: ' + error.message);
      res.status(500).send('Erro ao verificar núcleo');
      return;
    }

    // Verificar se o núcleo com o ID fornecido foi encontrado
    if (results.length === 0) {
      res.status(404).send('Núcleo não encontrado');
      return;
    }

    // Atualizar o campo específico do núcleo no banco de dados
    const updateFieldQuery = `UPDATE Nucleo SET ${campoAAlterar} = ? WHERE ID = ?`;
    connection.query(updateFieldQuery, [novoValor, nucleoId], (error, results) => {
      if (error) {
        console.error('Erro ao atualizar campo do núcleo: ' + error.message);
        res.status(500).send('Erro ao atualizar campo do núcleo');
        return;
      }
      console.log(`Campo ${campoAAlterar} do núcleo ${nucleoId} atualizado com sucesso!`);
      res.status(200).send(`Campo ${campoAAlterar} do núcleo ${nucleoId} atualizado com sucesso!`);
    });
  });
};
const updateNucleoFoto = async (req, res) => {
  const { id } = req.params;
  const upload = req.file;
  console.log('id: ' + upload);
  // Assegurar que a imagem foi enviada corretamente
  if (!upload || !upload.filename) {
    res.status(400).send('Imagem não foi enviada corretamente');
    return;
  }

  const image = `https://storage.googleapis.com/${BUCKET}/${upload.filename}`;

  try {
    const updateFotoQuery = 'UPDATE Nucleo SET fotoCapa = ? WHERE ID = ?';
    connection.query(updateFotoQuery, [image, id], async (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send('Erro ao atualizar a foto do núcleo');
      }
      return res.status(200).send('Foto do núcleo atualizada com sucesso');
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send('Erro ao atualizar a foto do núcleo');
  }
};

const interestFoundingNucleo = async(req, res) => {
  const { name, email, city , history } = req.body;
  
  if (!name || !email || !city || !history) {
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
    to: process.env.FINAL_EMAIL,
    subject: `Mensagem de ${name} fundar nucleo`,
    text: `
${name} está interessado em fundar um núcleo!

Cidade e Estado de Origem: ${city} 

Mensagem: ${history}

------------------
Por favor, não responda a este e-mail.
      `,
  };

  try {
    let info = await transporter.sendMail(mailOptions);
    console.log('Email enviado: ' + info.response);
    res.send('success');
  } catch (error) {
    console.log(error);
    res.status(500).send('error');
  }
}



module.exports = { CreateNucleo, LoginNucleo, GetAllNucleos, GetNucleoById, getApprovedNucleos, updateNucleoStatus, patchNucleo, updateNucleoFoto, deleteNucleo , interestFoundingNucleo }

