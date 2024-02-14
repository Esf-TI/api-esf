const jwt = require('jsonwebtoken');
const tokenSecret = 'chaveSecretaToken';
const verificarToken = (req, res, next) => {

    // Obter o token do cabeçalho Authorization
    const headerAuth = req.headers.authorization;

    // Verificar se o header Authorization foi enviado e se está no formato correto
    if (!headerAuth || !headerAuth.startsWith('Bearer')) {
        return res.status(401).send('Acesso negado!');
    }

    // Extrair apenas o token (removendo 'Bearer ' do início)
    const token = headerAuth.split(' ')[1];

    try {
        // Verificar se o token é válido
        const tokenVerificado = jwt.verify(token, tokenSecret); // Use a mesma chave usada para gerar o token
       
        // Se o token for válido, prosseguir para a próxima função de middleware ou rota
        req.usuario = tokenVerificado; // Anexar os dados do usuário decodificados ao objeto de requisição
        next();
    } catch (error) {
        // Se o token for inválido ou expirado, enviar uma resposta de erro de autenticação
        return res.status(401).send('Chave de autenticação da API inválida');
    }
};

module.exports = verificarToken;
