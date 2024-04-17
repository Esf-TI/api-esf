const bcrypt = require('bcrypt');
const connection = require('../connection');
const { generateTokens, refreshAccessToken, authenticateToken } = require('../middlewares/authFunctions');

const updateToken = async (req, res) => {
    // Espera receber o refreshToken como um cookie, header ou no body da requisição
    const refreshToken = req.body.refreshToken || req.cookies.refreshToken || req.headers['x-refresh-token'];
  
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token não fornecido' });
    }
  
    // Chamando a função refreshAccessToken que faz a validação e cria novos tokens
 await refreshAccessToken(refreshToken)
    .then(newTokens => {
      if (newTokens) {
        res.json({
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
            accessTokenExpires: newTokens.accessTokenExpires,
            refreshTokenExpires: newTokens.refreshTokenExpires
          });
      } else {
        console.log('Failed to refresh tokens.');
      }
    })
    .catch(error => {
      console.error('Error in refreshing tokens:', error);
    });

  
    
  };
  
  module.exports = { updateToken };

const create = async(req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
      return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
  }

  try {
      const checkEmail = `SELECT email FROM Admin WHERE email = ?`;
      connection.query(checkEmail, [email], async (error, results, fields) => {
          if (error) {
              console.error('Erro ao verificar email: ' + error.stack);
              return res.status(500).json({ message: 'Erro ao verificar email' });
          }

          if (results.length > 0) {
              return res.status(409).json({ message: 'Email já está em uso.' });
          } else {

              const saltRounds = 10;
              const hashedPassword = await bcrypt.hash(password, saltRounds);

              const sql = `INSERT INTO Admin (email, password) VALUES (?, ?)`;
              connection.query(sql, [email, hashedPassword], (error, results, fields) => {
                  if (error) {
                      console.error('Erro ao inserir administrador: ' + error.stack);
                      return res.status(500).json({ message: 'Erro ao criar administrador' });
                  }

                  res.status(201).json({ message: 'Administrador criado com sucesso.', id: results.insertId });
              });
          }
      });
  } catch (error) {
      console.error('Erro ao criar administrador: ' + error.message);
      res.status(500).json({ message: 'Erro interno do servidor ao criar administrador' });
  }
}

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
      return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
  }

  try {
      const sql = `SELECT * FROM Admin WHERE email = ?`;
      connection.query(sql, [email], async (error, results, fields) => {
          if (error) {
              console.error('Erro ao buscar usuário: ' + error.stack);
              return res.status(500).json({ message: 'Erro ao buscar usuário' });
          }

          if (results.length === 0) {
              return res.status(401).json({ message: 'Credenciais inválidas.' });
          }

          const admin = results[0];
          const passwordIsValid = await bcrypt.compare(password, admin.password);

          if (!passwordIsValid) {
              return res.status(401).json({ message: 'Credenciais inválidas.' });
          }

          const { accessToken, refreshToken, accessTokenExpires, refreshTokenExpires } = generateTokens(admin.id,"admin" );

          const checkTokenSql = `SELECT * FROM AdminTokens WHERE adminId = ?`;
          connection.query(checkTokenSql, [admin.id], (error, tokenResults) => {
              if (error) {
                  console.error('Erro ao verificar tokens existentes: ' + error.stack);
                  return res.status(500).json({ message: 'Erro ao verificar tokens existentes' });
              }

              let tokenSql;
              if (tokenResults.length > 0) {
                  tokenSql = `UPDATE AdminTokens SET accessToken = ?, refreshToken = ?, accessTokenExpires = ?, refreshTokenExpires = ? WHERE adminId = ?`;
              } else {
                  tokenSql = `INSERT INTO AdminTokens (accessToken, refreshToken, accessTokenExpires, refreshTokenExpires, adminId) VALUES (?, ?, ?, ?, ?)`;
              }

              connection.query(tokenSql, [accessToken, refreshToken, accessTokenExpires, refreshTokenExpires, admin.id], (error, updateResults) => {
                  if (error) {
                      console.error('Erro ao inserir ou atualizar tokens: ' + error.stack);
                      return res.status(500).json({ message: 'Erro ao salvar os tokens no banco de dados' });
                  }

                  res.status(200).json({
                      message: 'Login realizado com sucesso.',
                      accessToken,
                      refreshToken,
                      accessTokenExpires,
                      refreshTokenExpires
                  });
              });
          });
      });
  } catch (error) {
      console.error('Erro ao processar o login: ' + error.message);
      res.status(500).json({ message: 'Erro interno do servidor ao processar o login' });
  }
};



module.exports = {create, login, updateToken}