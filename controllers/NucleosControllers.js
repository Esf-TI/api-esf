const connection = require('../connection');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const tokenSecret = process.env.JWT_SECRET;

const CreateNucleo = async (req, res) => {
  const { nome, email, senha, cidade, descricao } = req.body;
  console.log(nome, email, senha, cidade)
  // Verificação se todos os campos estão preenchidos
  if (!nome || !email || !senha || !cidade || !descricao) {
    return res.status(400).send('Por favor, preencha todos os campos');
  }

  try {
    // Geração do hash da senha
    const hashedPassword = await bcrypt.hash(senha, 10); // O segundo argumento é o "salt rounds"

    const inserirNucleo = 'INSERT INTO Nucleo (Nome, Email, Senha, Cidade, Descricao) VALUES (?, ?, ?, ?, ?)';
    connection.query(inserirNucleo, [nome, email, hashedPassword, cidade, descricao], async (err, result) => {
      if (err) {
        console.log(err);
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).send('E-mail já cadastrado'); // Ou a mensagem que preferir
        }
        return res.status(500).send('Erro ao criar o núcleo');
      }
      return res.status(200).send('Núcleo criado com sucesso');
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send('Erro ao criar o núcleo');
  }
};

const LoginNucleo = async (req, res) => {
  const { email, senha } = req.body;

  // Verificação se o email e senha foram fornecidos
  if (!email || !senha) {
    return res.status(400).send('Por favor, forneça o email e a senha');
  }

  try {
    // Verificar se o email existe no banco de dados
    const buscarNucleo = 'SELECT * FROM Nucleo WHERE Email = ?';
    connection.query(buscarNucleo, [email], async (err, results) => {
      if (err) {
        console.log(err);
        return res.status(500).send('Erro ao tentar fazer o login');
      }

      // Verificar se o email foi encontrado
      if (results.length === 0) {
        return res.status(404).send('Usuário não encontrado');
      }

      const nucleo = results[0];

      // Comparar a senha fornecida com a senha criptografada no banco de dados
      const senhaCorrespondente = await bcrypt.compare(senha, nucleo.Senha);
      if (!senhaCorrespondente) {
        return res.status(401).send('Senha incorreta');
      }

      // Gerar o token JWT com as informações do usuário
      const token = jwt.sign({ id: nucleo.ID, email: nucleo.Email }, tokenSecret, { expiresIn: '1h' });

      // Armazenar o token no banco de dados
      const atualizarToken = 'UPDATE Nucleo SET Token = ? WHERE ID = ?';
      connection.query(atualizarToken, [token, nucleo.ID], (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).send('Erro ao gerar o token');
        }

        // Retornar o token como resposta
        return res.status(200).json({ token });
      });
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send('Erro ao tentar fazer o login');
  }
};


module.exports = { CreateNucleo,LoginNucleo }

