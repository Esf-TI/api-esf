// arquivo database.js
const mysql = require('mysql');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'esf'
});

connection.connect((err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados: ' + err.stack);
        return;
    }
    console.log('Conexão bem-sucedida ao banco de dados MySQL!');

    // Verificar se o banco de dados existe e, se não existir, criá-lo
    connection.query("CREATE DATABASE IF NOT EXISTS esf", (err, result) => {
        if (err) {
            console.error('Erro ao criar o banco de dados: ' + err.stack);
            return;
        }
        console.log('Banco de dados criado com sucesso ou já existente!');

        // Usar o banco de dados esf
        connection.query("USE esf", (err, result) => {
            if (err) {
                console.error('Erro ao selecionar o banco de dados: ' + err.stack);
                return;
            }
            console.log('Banco de dados selecionado com sucesso!');

            // Criar tabela Nucleo
            connection.query(`CREATE TABLE IF NOT EXISTS Nucleo (
                ID INT AUTO_INCREMENT PRIMARY KEY,
                Nome VARCHAR(255),
                Email VARCHAR(255),
                Senha VARCHAR(255),
                Cidade VARCHAR(255),
                Descricao TEXT,
                DataFundacao DATE,
                fotoCapa VARCHAR(255),
                linkDoacao VARCHAR(255),
                linkSite VARCHAR(255),
                linkLinkedin VARCHAR(255),
                linkFacebook VARCHAR(255),
                linkInstagram VARCHAR(255)
            )`, (err, result) => {
                if (err) {
                    console.error('Erro ao criar a tabela Nucleo: ' + err.stack);
                    return;
                }
                console.log('Tabela Nucleo criada com sucesso ou já existente!');
                
                // Criar tabela Projetos
                connection.query(`CREATE TABLE IF NOT EXISTS Projetos (
                    ID INT AUTO_INCREMENT PRIMARY KEY,
                    Nome VARCHAR(255),
                    NucleoResponsavel INT,
                    Descricao TEXT,
                    Area VARCHAR(255),
                    PessoasImpactadas INT,
                    DataFundacao DATE,
                    Cidade VARCHAR(255),
                    fotoCapa VARCHAR(255),
                    foto1 VARCHAR(255),
                    foto2 VARCHAR(255),
                    foto3 VARCHAR(255),
                    foto4 VARCHAR(255),
                    foto5 VARCHAR(255),
                    FOREIGN KEY (NucleoResponsavel) REFERENCES Nucleo(ID)
                )`, (err, result) => {
                    if (err) {
                        console.error('Erro ao criar a tabela Projetos: ' + err.stack);
                        return;
                    }
                    console.log('Tabela Projetos criada com sucesso ou já existente!');
                });
            });
        });
    });
});



module.exports = connection;
