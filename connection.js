const mysql = require("mysql")

// Detectar ambiente (development ou production)
const isDevelopment = process.env.NODE_ENV === "development" || !process.env.NODE_ENV

// Configurações de banco de dados baseadas no ambiente
const dbConfig = isDevelopment
  ? {
      // Configuração de DESENVOLVIMENTO (localhost)
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "esf",
    }
  : {
      // Configuração de PRODUÇÃO (servidor remoto)
      host: process.env.DB_HOST || "esf.org.br",
      user: process.env.DB_USER || "esfor8190_dev",
      password: process.env.DB_PASSWORD || "123456789ESF.202324",
      database: process.env.DB_NAME || "esfor8190_bancoplataforma",
    }

console.log(`🔌 Conectando ao banco de dados em modo: ${isDevelopment ? "DESENVOLVIMENTO" : "PRODUÇÃO"}`)

const connection = mysql.createConnection(dbConfig)

connection.connect((err) => {
  if (err) {
    console.error("Erro ao conectar ao banco de dados: " + err.stack)
    return
  }
  console.log("Conexão bem-sucedida ao banco de dados MySQL!")

  // Verificar se o banco de dados existe e, se não existir, criá-lo
  connection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`, (err, result) => {
    if (err) {
      console.error("Erro ao criar o banco de dados: " + err.stack)
      return
    }
    console.log("Banco de dados criado com sucesso ou já existente!")

    // Usar o banco de dados
    connection.query(`USE ${dbConfig.database}`, (err, result) => {
      if (err) {
        console.error("Erro ao selecionar o banco de dados: " + err.stack)
        return
      }
      console.log("Banco de dados selecionado com sucesso!")

      connection.query(
        `CREATE TABLE IF NOT EXISTS Admin (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                senha VARCHAR(255) NOT NULL,
                role ENUM('super_admin', 'admin', 'moderator') DEFAULT 'admin',
                status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
                last_login DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_status (status),
                INDEX idx_role (role)
            )`,
        (err, result) => {
          if (err) {
            console.error("Erro ao criar a tabela Admin: " + err.stack)
            return
          }
          console.log("Tabela Admin criada com sucesso!")
        },
      )

      connection.query(
        `CREATE TABLE IF NOT EXISTS Blog (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL UNIQUE,
                description LONGTEXT,
                content LONGTEXT,
                image VARCHAR(255),
                author_id INT,
                status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
                views INT DEFAULT 0,
                featured BOOLEAN DEFAULT FALSE,
                meta_description TEXT,
                tags JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                published_at DATETIME NULL,
                FOREIGN KEY (author_id) REFERENCES Admin(id),
                INDEX idx_status (status),
                INDEX idx_slug (slug),
                INDEX idx_author (author_id),
                INDEX idx_published (published_at)
            )`,
        (err, result) => {
          if (err) {
            console.error("Erro ao criar a tabela Blog: " + err.stack)
            return
          }
          console.log("Tabela Blog criada com sucesso!")
        },
      )

      connection.query(
        `CREATE TABLE IF NOT EXISTS Nucleo (
                ID INT AUTO_INCREMENT PRIMARY KEY,
                Nome VARCHAR(255) NOT NULL,
                Email VARCHAR(255) NOT NULL UNIQUE,
                Senha VARCHAR(255) NOT NULL,
                Cidade VARCHAR(255),
                Estado VARCHAR(255),
                subdominio VARCHAR(255) UNIQUE,
                Descricao TEXT,
                DataFundacao DATE,
                fotoCapa VARCHAR(255),
                foto1 VARCHAR(255),
                foto2 VARCHAR(255),
                foto3 VARCHAR(255),
                linkDoacao VARCHAR(255),
                linkSite VARCHAR(255),
                linkLinkedin VARCHAR(255),
                linkFacebook VARCHAR(255),
                linkInstagram VARCHAR(255),
                status ENUM('pending', 'approved', 'rejected', 'suspended') DEFAULT 'pending',
                rejection_reason TEXT NULL,
                approved_by INT NULL,
                approved_at DATETIME NULL,
                Token VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (approved_by) REFERENCES Admin(id),
                INDEX idx_status (status),
                INDEX idx_email (Email),
                INDEX idx_subdominio (subdominio)
            )`,
        (err, result) => {
          if (err) {
            console.error("Erro ao criar a tabela Nucleo: " + err.stack)
            return
          }
          console.log("Tabela Nucleo criada com sucesso ou já existente!")

          connection.query(
            `CREATE TABLE IF NOT EXISTS Projetos (
                    ID INT AUTO_INCREMENT PRIMARY KEY,
                    Nome VARCHAR(255) NOT NULL,
                    NucleoResponsavel INT,
                    Descricao TEXT,
                    Area VARCHAR(255),
                    PessoasImpactadas INT,
                    DataFundacao DATE,
                    Cidade VARCHAR(255),
                    Estado VARCHAR(255),
                    fotoCapa VARCHAR(255),
                    foto1 VARCHAR(255),
                    foto2 VARCHAR(255),
                    foto3 VARCHAR(255),
                    foto4 VARCHAR(255),
                    foto5 VARCHAR(255),
                    status ENUM('active', 'inactive', 'completed', 'suspended') DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (NucleoResponsavel) REFERENCES Nucleo(ID) ON DELETE CASCADE,
                    INDEX idx_nucleo (NucleoResponsavel),
                    INDEX idx_status (status),
                    INDEX idx_area (Area)
                )`,
            (err, result) => {
              if (err) {
                console.error("Erro ao criar a tabela Projetos: " + err.stack)
                return
              }
              console.log("Tabela Projetos criada com sucesso ou já existente!")
            },
          )

          connection.query(
            `CREATE TABLE IF NOT EXISTS admin_audit_logs (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            admin_id INT NOT NULL,
                            action VARCHAR(100) NOT NULL,
                            target_type ENUM('nucleo', 'blog', 'project', 'admin') NOT NULL,
                            target_id INT,
                            details JSON,
                            ip_address VARCHAR(45),
                            user_agent TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (admin_id) REFERENCES Admin(id),
                            INDEX idx_admin (admin_id),
                            INDEX idx_action (action),
                            INDEX idx_target (target_type, target_id),
                            INDEX idx_created (created_at)
                        )`,
            (err, result) => {
              if (err) {
                console.error("Erro ao criar a tabela admin_audit_logs: " + err.stack)
                return
              }
              console.log("Tabela admin_audit_logs criada com sucesso!")
            },
          )

          connection.query(
            `CREATE TABLE IF NOT EXISTS contato_messages (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            nome VARCHAR(255) NOT NULL,
                            email VARCHAR(255) NOT NULL,
                            telefone VARCHAR(20),
                            assunto VARCHAR(255),
                            mensagem TEXT NOT NULL,
                            status ENUM('new', 'read', 'replied', 'archived') DEFAULT 'new',
                            replied_by INT NULL,
                            replied_at DATETIME NULL,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (replied_by) REFERENCES Admin(id),
                            INDEX idx_status (status),
                            INDEX idx_email (email),
                            INDEX idx_created (created_at)
                        )`,
            (err, result) => {
              if (err) {
                console.error("Erro ao criar a tabela contato_messages: " + err.stack)
                return
              }
              console.log("Tabela contato_messages criada com sucesso!")
            },
          )

          connection.query(
            `CREATE TABLE IF NOT EXISTS AdminTokens (
                                id INT AUTO_INCREMENT PRIMARY KEY,
                                adminId INT,
                                accessToken VARCHAR(255),
                                refreshToken VARCHAR(255),
                                accessTokenExpires DATETIME,
                                refreshTokenExpires DATETIME,
                                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY (adminId) REFERENCES Admin(id)
                            )`,
            (err, result) => {
              if (err) {
                console.error("Erro ao criar a tabela AdminTokens: " + err.stack)
                return
              }
              console.log("Tabela AdminTokens criada com sucesso!")
            },
          )

          connection.query(
            `CREATE TABLE IF NOT EXISTS NucleoTokens (
                                id INT AUTO_INCREMENT PRIMARY KEY,
                                nucleoId INT,
                                accessToken VARCHAR(255),
                                refreshToken VARCHAR(255),
                                accessTokenExpires DATETIME,
                                refreshTokenExpires DATETIME,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY (nucleoId) REFERENCES Nucleo(ID)
                            )`,
            (err, result) => {
              if (err) {
                console.error("Erro ao criar a tabela NucleoTokens: " + err.stack)
                return
              }
              console.log("Tabela NucleoTokens criada com sucesso!")
            },
          )

          connection.query(
            `CREATE TABLE IF NOT EXISTS AdminLogs (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            adminId INT,
                            action VARCHAR(100) NOT NULL,
                            details JSON,
                            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (adminId) REFERENCES Admin(id),
                            INDEX idx_admin (adminId),
                            INDEX idx_action (action),
                            INDEX idx_timestamp (timestamp)
                        )`,
            (err, result) => {
              if (err) {
                console.error("Erro ao criar a tabela AdminLogs: " + err.stack)
                return
              }
              console.log("Tabela AdminLogs criada com sucesso!")
            },
          )

          connection.query(
            `CREATE TABLE IF NOT EXISTS Anais (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            title VARCHAR(255) NOT NULL,
                            description TEXT,
                            year INT NOT NULL,
                            event_name VARCHAR(255),
                            pdf_url VARCHAR(500) NOT NULL,
                            cover_image_url VARCHAR(500),
                            authors VARCHAR(500),
                            pages INT,
                            isbn VARCHAR(50),
                            doi VARCHAR(100),
                            keywords JSON,
                            category ENUM('technical', 'research', 'workshop', 'other') DEFAULT 'technical',
                            status ENUM('active', 'archived', 'deleted') DEFAULT 'active',
                            downloads INT DEFAULT 0,
                            views INT DEFAULT 0,
                            featured BOOLEAN DEFAULT FALSE,
                            created_by INT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                            published_at DATETIME NULL,
                            FOREIGN KEY (created_by) REFERENCES Admin(id),
                            INDEX idx_year (year),
                            INDEX idx_status (status),
                            INDEX idx_category (category),
                            INDEX idx_featured (featured),
                            INDEX idx_created_at (created_at)
                        )`,
            (err, result) => {
              if (err) {
                console.error("Erro ao criar a tabela Anais: " + err.stack)
                return
              }
              console.log("Tabela Anais criada com sucesso!")
            },
          )
        },
      )
    })
  })
})

module.exports = connection
