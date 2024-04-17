const jwt = require('jsonwebtoken');
require('dotenv').config();
const moment = require('moment');
const connection = require('../connection');

const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;

function generateTokens(userId, type) {
  const payload = { userId, type };

  const accessTokenExpiresIn = '1d'; 
  const refreshTokenExpiresIn = '7d'; 

  const accessToken = jwt.sign(payload, accessTokenSecret, { expiresIn: accessTokenExpiresIn });
  const refreshToken = jwt.sign(payload, refreshTokenSecret, { expiresIn: refreshTokenExpiresIn });

  const accessTokenExpires = moment().add(1, 'days').toDate();
  const refreshTokenExpires = moment().add(7, 'days').toDate();

  return {
      accessToken,
      refreshToken,
      accessTokenExpires,
      refreshTokenExpires
  };
}

async function refreshAccessToken(refreshToken) {
  try {
    const decoded = jwt.verify(refreshToken, refreshTokenSecret);
    const { userId, type } = decoded;
    const accessToken = jwt.sign(
      { userId, type }, 
      accessTokenSecret, 
      { expiresIn: '1d' }
    );

    const newRefreshToken = jwt.sign(
      { userId, type },
      refreshTokenSecret,
      { expiresIn: '7d' }
    );

    const accessTokenExpires = new Date(Date.now() + 86400000); 
    const refreshTokenExpires = new Date(Date.now() + 604800000); 

    // Determine the appropriate table based on user type
    const table = type === 'admin' ? 'AdminTokens' : 'NucleoTokens';
    const user = type === 'admin' ? 'adminId' : 'nucleoId';
    const sql = `UPDATE ${table} SET accessToken = ?, refreshToken = ?, refreshTokenExpires = ?, accessTokenExpires = ? WHERE ${user} = ?`;

    const results = await new Promise((resolve, reject) => {
      connection.query(sql, [accessToken,newRefreshToken, refreshTokenExpires, accessTokenExpires, userId], (error, results) => {
        if (error) {
          console.error('Error updating refresh token in database:', error);
          reject(null);
        } else if (results.affectedRows === 0) {
          console.error('No refresh token was updated, invalid userId or table');
          reject(null);
        } else {
          resolve(results);
        }
      });
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      accessTokenExpires,
      refreshTokenExpires
    };
  } catch (error) {
    console.error('Error refreshing tokens:', error);
    return null;
  }
}

function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token não fornecido' });
  }

  jwt.verify(token, accessTokenSecret, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Token inválido ou expirado' });
    }

    // Verificar se o token está na tabela AdminTokens
    const sql = 'SELECT * FROM AdminTokens WHERE accessToken = ?';
    connection.query(sql, [token], (error, results) => {
      if (error) {
        return res.status(500).json({ message: 'Erro ao validar o token' });
      }

      if (results.length === 0) {
        return res.status(403).json({ message: 'Token não autorizado para esta ação' });
      }

      req.user = decoded;
      next();
    });
  });
}

function authenticateNucleo(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token não fornecido' });
  }

  jwt.verify(token, accessTokenSecret, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Token inválido ou expirado' });
    }

    const sql = 'SELECT * FROM NucleosTokens WHERE accessToken = ?';
    connection.query(sql, [token], (error, results) => {
      if (error) {
        return res.status(500).json({ message: 'Erro ao validar o token' });
      }

      if (results.length === 0) {
        return res.status(403).json({ message: 'Token não autorizado para esta ação' });
      }

      req.user = decoded;
      next();
    });
  });
}

module.exports = {generateTokens, refreshAccessToken, authenticateAdmin, authenticateNucleo}