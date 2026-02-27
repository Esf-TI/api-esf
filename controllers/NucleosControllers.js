const connection = require("../connection")
const BUCKET = "engenheiros-sem-fronteiras.appspot.com"
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const nodemailer = require("nodemailer")
const { generateTokens, refreshAccessToken, authenticateToken } = require("../middlewares/authFunctions")
const { createSubdomain } = require("../middlewares/domainFunctions")
require("dotenv").config()

const tokenSecret = process.env.JWT_SECRET

const validateNucleoData = (data) => {
  const errors = []
  const requiredFields = ["email", "senha", "nomeNucleo", "descricao", "cidade", "estado", "dataFundacao"]

  requiredFields.forEach((field) => {
    if (!data[field] || data[field].toString().trim() === "") {
      errors.push(`${field} é obrigatório`)
    }
  })

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (data.email && !emailRegex.test(data.email)) {
    errors.push("Formato de email inválido")
  }

  // Password validation
  if (data.senha && data.senha.length < 8) {
    errors.push("A senha deve ter pelo menos 8 caracteres")
  }

  return errors
}

const deleteNucleo = async (req, res) => {
  const { id } = req.params // ID do núcleo a ser deletado, assumindo que é passado na URL

  if (!id) {
    return res.status(400).send("ID do núcleo não fornecido")
  }

  try {
    connection.beginTransaction((txErr) => {
      if (txErr) {
        console.error(txErr)
        return res.status(500).send("Erro ao iniciar transação")
      }

      const deleteTokensQuery = "DELETE FROM NucleoTokens WHERE nucleoId = ?"
      const deleteProjectsQuery = "DELETE FROM Projetos WHERE NucleoResponsavel = ?"
      const deleteNucleoQuery = "DELETE FROM Nucleo WHERE ID = ?"

      connection.query(deleteTokensQuery, [id], (tokensErr) => {
        if (tokensErr) {
          return connection.rollback(() => {
            console.error(tokensErr)
            res.status(500).send("Erro ao deletar tokens do núcleo")
          })
        }

        connection.query(deleteProjectsQuery, [id], (projectsErr) => {
          if (projectsErr) {
            return connection.rollback(() => {
              console.error(projectsErr)
              res.status(500).send("Erro ao deletar projetos do núcleo")
            })
          }

          connection.query(deleteNucleoQuery, [id], (nucleoErr, result) => {
            if (nucleoErr) {
              return connection.rollback(() => {
                console.error(nucleoErr)
                if (nucleoErr.code === "ER_ROW_IS_REFERENCED_2") {
                  res.status(409).send("Núcleo possui dependências e não pode ser removido.")
                } else {
                  res.status(500).send("Erro ao deletar o núcleo")
                }
              })
            }

            if (result.affectedRows === 0) {
              return connection.rollback(() => {
                res.status(404).send("Núcleo não encontrado")
              })
            }

            connection.commit((commitErr) => {
              if (commitErr) {
                return connection.rollback(() => {
                  console.error(commitErr)
                  res.status(500).send("Erro ao finalizar transação")
                })
              }
              return res.status(200).send("Núcleo deletado com sucesso")
            })
          })
        })
      })
    })
  } catch (error) {
    console.error(error)
    return res.status(500).send("Erro ao tentar deletar o núcleo")
  }
}

const CreateNucleo = async (req, res) => {
  try {
    const {
      email,
      senha,
      nomeNucleo,
      descricao,
      cidade,
      estado,
      dataFundacao,
      linkDoacao,
      linkSite,
      linkLinkedin,
      linkFacebook,
      linkInstagram,
    } = req.body
    const upload = req.file

    const validationErrors = validateNucleoData(req.body)
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Dados inválidos",
        errors: validationErrors,
      })
    }

    // Validar data de fundação (não pode ser futura)
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const dataFundacaoDate = new Date(dataFundacao)
    dataFundacaoDate.setHours(0, 0, 0, 0)
    if (dataFundacaoDate > hoje) {
      return res.status(400).json({
        success: false,
        message: "Data de fundação não pode ser no futuro",
      })
    }

    // Verificar se e-mail já existe
    const checkEmailQuery = "SELECT email FROM Nucleo WHERE Email = ?"
    connection.query(checkEmailQuery, [email], async (emailError, emailResults) => {
      if (emailError) {
        console.error("Database error checking email:", emailError)
        return res.status(500).json({
          success: false,
          message: "Erro ao verificar email",
        })
      }

      if (emailResults.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Email já cadastrado",
        })
      }

      if (!upload || !upload.filename) {
        return res.status(400).json({
          success: false,
          message: "Imagem é obrigatória",
        })
      }

      const image = `https://storage.googleapis.com/${BUCKET}/${upload.filename}`
      const hashedPassword = await bcrypt.hash(senha, 12)

      const inserirNucleo = `
        INSERT INTO Nucleo (
          Nome, Email, Senha, Cidade, Estado, Descricao, DataFundacao, fotoCapa,
          linkDoacao, linkSite, linkLinkedin, linkFacebook, linkInstagram,
          status, subdominio
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `

      connection.query(
        inserirNucleo,
        [
          nomeNucleo,
          email,
          hashedPassword,
          cidade,
          estado,
          descricao,
          dataFundacao,
          image,
          linkDoacao,
          linkSite,
          linkLinkedin,
          linkFacebook,
          linkInstagram,
          "pending",
          null,
        ],
        async (err, result) => {
          if (err) {
            console.error("Database error creating nucleo:", err)
            if (err.code === "ER_DUP_ENTRY") {
              return res.status(409).json({
                success: false,
                message: "E-mail já cadastrado",
              })
            }
            return res.status(500).json({
              success: false,
              message: "Erro ao criar o núcleo",
            })
          }

          const { logAdminAction } = require("./AdminController")
          logAdminAction(null, "NUCLEO_CREATED", {
            nucleoId: result.insertId,
            nomeNucleo,
            email,
            cidade,
          })

          res.status(201).json({
            success: true,
            message: "Núcleo criado com sucesso!",
            data: {
              id: result.insertId,
              nome: nomeNucleo,
              status: "pending",
            },
          })
        },
      )
    })
  } catch (error) {
    console.error("Error creating nucleo:", error)
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
    })
  }
}

const CreateNucleoByAdmin = async (req, res) => {
  try {
    const {
      email,
      senha,
      nomeNucleo,
      descricao,
      cidade,
      estado = "",
      dataFundacao,
      linkDoacao = "",
      linkSite = "",
      linkLinkedin = "",
      linkFacebook = "",
      linkInstagram = "",
    } = req.body

    // Minimal validation for admin creation
    const requiredFields = ["email", "senha", "nomeNucleo", "cidade"]
    const missingFields = requiredFields.filter((field) => !req.body[field] || req.body[field].toString().trim() === "")

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Campos obrigatórios faltando",
        errors: missingFields.map((field) => `${field} é obrigatório`),
      })
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Formato de email inválido",
      })
    }

    // Password validation
    if (senha.length < 6) {
      return res.status(400).json({
        success: false,
        message: "A senha deve ter pelo menos 6 caracteres",
      })
    }

    if (dataFundacao) {
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      const dataFundacaoDate = new Date(dataFundacao)
      dataFundacaoDate.setHours(0, 0, 0, 0)
      if (dataFundacaoDate > hoje) {
        return res.status(400).json({
          success: false,
          message: "Data de fundação não pode ser no futuro",
        })
      }
    }

    // Check if email already exists
    const checkEmailQuery = "SELECT email FROM Nucleo WHERE Email = ?"
    connection.query(checkEmailQuery, [email], async (error, results) => {
      if (error) {
        console.error("Database error checking email:", error)
        return res.status(500).json({
          success: false,
          message: "Erro ao verificar email",
        })
      }

      if (results.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Email já está em uso",
        })
      }

      const hashedPassword = await bcrypt.hash(senha, 12)
      const defaultImage = "/placeholder.svg?height=400&width=600"

      const inserirNucleo = `
        INSERT INTO Nucleo (
          Nome, Email, Senha, Cidade, Estado, Descricao, DataFundacao, fotoCapa,
          linkDoacao, linkSite, linkLinkedin, linkFacebook, linkInstagram,
          status, subdominio
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `

      connection.query(
        inserirNucleo,
        [
          nomeNucleo,
          email,
          hashedPassword,
          cidade,
          estado,
          descricao || `Núcleo ${nomeNucleo} criado pelo administrador`,
          dataFundacao || new Date().toISOString().split("T")[0],
          defaultImage,
          linkDoacao,
          linkSite,
          linkLinkedin,
          linkFacebook,
          linkInstagram,
          "approved", // Admin-created nucleos are auto-approved
          null, // Subdomain will be created when approved, same as original function
        ],
        async (err, result) => {
          if (err) {
            console.error("Database error creating nucleo:", err)
            return res.status(500).json({
              success: false,
              message: "Erro ao criar o núcleo",
            })
          }

          try {

            res.status(201).json({
              success: true,
              message: "Núcleo criado com sucesso pelo administrador!",
              data: {
                id: result.insertId,
                nome: nomeNucleo,
                email,
                cidade,
                status: "approved",
              },
            })
          } catch (subdomainError) {
            console.error("Error creating subdomain:", subdomainError)
            // Still return success even if subdomain creation fails
            res.status(201).json({
              success: true,
              message: "Núcleo criado com sucesso pelo administrador! (Subdomínio será criado posteriormente)",
              data: {
                id: result.insertId,
                nome: nomeNucleo,
                email,
                cidade,
                status: "approved",
              },
            })
          }
        },
      )
    })
  } catch (error) {
    console.error("Error creating nucleo by admin:", error)
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
    })
  }
}

const LoginNucleo = async (req, res) => {
  const { email, senha } = req.body

  if (!email || !senha) {
    return res.status(400).send("Por favor, forneça o email e a senha")
  }

  try {
    const buscarNucleo = "SELECT * FROM Nucleo WHERE Email = ?"
    connection.query(buscarNucleo, [email], async (err, results) => {
      if (err) {
        console.error("Erro ao tentar fazer o login:", err)
        return res.status(500).send("Erro ao tentar fazer o login")
      }

      if (results.length === 0) {
        return res.status(404).send("Usuário não encontrado")
      }

      const nucleo = results[0]
      const senhaCorrespondente = await bcrypt.compare(senha, nucleo.Senha)
      if (!senhaCorrespondente) {
        return res.status(401).send("Senha incorreta")
      }

      if (nucleo.status != "approved") {
        return res.status(409).send("Nucleo nao aprovado")
      }

      const tokens = generateTokens(nucleo.ID, "nucleo")

      const limparTokensSql = "DELETE FROM NucleoTokens WHERE nucleoId = ?"
      connection.query(limparTokensSql, [nucleo.ID], (err, deleteResult) => {
        if (err) {
          console.error("Erro ao limpar tokens antigos:", err)
          return res.status(500).send("Erro ao atualizar tokens")
        }

        const insertTokensSql =
          "INSERT INTO NucleoTokens (nucleoId, accessToken, refreshToken, accessTokenExpires, refreshTokenExpires) VALUES (?, ?, ?, ?, ?)"
        connection.query(
          insertTokensSql,
          [nucleo.ID, tokens.accessToken, tokens.refreshToken, tokens.accessTokenExpires, tokens.refreshTokenExpires],
          (err, insertResult) => {
            if (err) {
              console.error("Erro ao inserir novos tokens:", err)
              return res.status(500).send("Erro ao salvar os tokens no banco de dados")
            }

            res.status(200).json({
              message: "Login realizado com sucesso.",
              id: nucleo.ID,
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
              accessTokenExpires: tokens.accessTokenExpires,
              refreshTokenExpires: tokens.refreshTokenExpires,
              subdominio: nucleo.subdominio,
            })
          },
        )
      })
    })
  } catch (error) {
    console.error("Erro ao tentar fazer o login:", error)
    return res.status(500).send("Erro ao tentar fazer o login")
  }
}

const GetAllNucleos = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, cidade, search, sortBy = "ID", sortOrder = "DESC" } = req.query

    const offset = (page - 1) * limit
    const whereConditions = []
    const queryParams = []

    if (status) {
      whereConditions.push("status = ?")
      queryParams.push(status)
    }

    if (cidade) {
      whereConditions.push("Cidade LIKE ?")
      queryParams.push(`%${cidade}%`)
    }

    if (search) {
      whereConditions.push("(Nome LIKE ? OR Email LIKE ? OR Descricao LIKE ?)")
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : ""

    // Count total records
    const countSql = `SELECT COUNT(*) as total FROM Nucleo ${whereClause}`

    connection.query(countSql, queryParams, (err, countResult) => {
      if (err) {
        console.error("Error counting nucleos:", err)
        return res.status(500).json({
          success: false,
          message: "Erro ao contar núcleos",
        })
      }

      const total = countResult[0].total

      // Get paginated results
      const sql = `
        SELECT *, 
        (SELECT COUNT(*) FROM Projetos WHERE NucleoResponsavel = Nucleo.ID) as totalProjetos
        FROM Nucleo 
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT ? OFFSET ?
      `

      queryParams.push(Number.parseInt(limit), Number.parseInt(offset))

      connection.query(sql, queryParams, (err, results) => {
        if (err) {
          console.error("Error fetching nucleos:", err)
          return res.status(500).json({
            success: false,
            message: "Erro ao buscar núcleos",
          })
        }

        res.json({
          success: true,
          data: {
            nucleos: results,
            pagination: {
              page: Number.parseInt(page),
              limit: Number.parseInt(limit),
              total,
              totalPages: Math.ceil(total / limit),
            },
          },
        })
      })
    })
  } catch (error) {
    console.error("Error in GetAllNucleos:", error)
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
    })
  }
}

const GetNucleoById = async (req, res) => {
  const nucleoId = req.params.id

  try {
    const buscarNucleoPorId = "SELECT * FROM Nucleo WHERE ID = ?"
    connection.query(buscarNucleoPorId, [nucleoId], async (err, results) => {
      if (err) {
        console.log(err)
        return res.status(500).send("Erro ao buscar o núcleo")
      }

      if (results.length === 0) {
        return res.status(404).send("Núcleo não encontrado")
      }

      return res.status(200).json(results[0])
    })
  } catch (error) {
    console.log(error)
    return res.status(500).send("Erro ao buscar o núcleo")
  }
}

const updateNucleoStatus = (req, res) => {
  const nucleoId = req.params.id
  const { novoStatus } = req.body

  if (!nucleoId || !novoStatus) {
    return res.status(400).json({
      success: false,
      message: "ID do núcleo e novo status são obrigatórios",
    })
  }

  if (!["approved", "reproved", "pending"].includes(novoStatus)) {
    return res.status(400).json({
      success: false,
      message: "Status deve ser: approved, reproved ou pending",
    })
  }

  const getNucleoQuery = "SELECT Nome, Email, subdominio FROM Nucleo WHERE ID = ?"
  connection.query(getNucleoQuery, [nucleoId], (error, results) => {
    if (error) {
      console.error("Error getting nucleo:", error)
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar núcleo",
      })
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Núcleo não encontrado",
      })
    }

    const { Nome: nucleoNome, Email: nucleoEmail, subdominio } = results[0]

    const updateStatusQuery = `UPDATE Nucleo SET status = ? WHERE ID = ?`

    connection.query(updateStatusQuery, [novoStatus, nucleoId], async (error, results) => {
      if (error) {
        console.error("Error updating nucleo status:", error)
        return res.status(500).json({
          success: false,
          message: "Erro ao atualizar status do núcleo",
        })
      }

      // Handle subdomain creation for approved nucleos
      if (novoStatus === "approved") {
        try {
          res.json({
            success: true,
            message: `Núcleo ${nucleoNome} ${novoStatus === "approved" ? "aprovado" : "reprovado"} com sucesso`,
            data: {
              nucleoId,
              nucleoNome,
              status: novoStatus,
            },
          })
        } catch (error) {
          console.error("Error creating subdomain:", error)
          res.status(500).json({
            success: false,
            message: "Erro ao criar subdomínio no local",
          })
        }
      } else {
        res.json({
          success: true,
          message: `Núcleo ${nucleoNome} ${novoStatus === "approved" ? "aprovado" : "reprovado"} com sucesso`,
          data: {
            nucleoId,
            nucleoNome,
            status: novoStatus,
          },
        })
      }
    })
  })
}

const patchNucleo = (req, res) => {
  const nucleoId = req.params.id // Obtenha o ID do núcleo a ser editado
  const { campoAAlterar, novoValor } = req.body

  // Verificar se todos os campos obrigatórios estão presentes
  if (!nucleoId || !campoAAlterar || !novoValor) {
    res.status(400).send("O ID do núcleo, o campo a ser alterado e o novo valor são obrigatórios")
    return
  }

  // Verificar se o núcleo com o ID fornecido existe no banco de dados
  const checkNucleoQuery = "SELECT * FROM Nucleo WHERE ID = ?"
  connection.query(checkNucleoQuery, [nucleoId], (error, results) => {
    if (error) {
      console.error("Erro ao verificar núcleo: " + error.message)
      res.status(500).send("Erro ao verificar núcleo")
      return
    }

    // Verificar se o núcleo com o ID fornecido foi encontrado
    if (results.length === 0) {
      res.status(404).send("Núcleo não encontrado")
      return
    }

    // Atualizar o campo específico do núcleo no banco de dados
    const updateFieldQuery = `UPDATE Nucleo SET ${campoAAlterar} = ? WHERE ID = ?`
    connection.query(updateFieldQuery, [novoValor, nucleoId], (error, results) => {
      if (error) {
        console.error("Erro ao atualizar campo do núcleo: " + error.message)
        res.status(500).send("Erro ao atualizar campo do núcleo")
        return
      }
      console.log(`Campo ${campoAAlterar} do núcleo ${nucleoId} atualizado com sucesso!`)
      res.status(200).send(`Campo ${campoAAlterar} do núcleo ${nucleoId} atualizado com sucesso!`)
    })
  })
}

const updateNucleoFoto = async (req, res) => {
  const { id } = req.params
  const upload = req.file
  console.log("id: " + upload)
  // Assegurar que a imagem foi enviada corretamente
  if (!upload || !upload.filename) {
    res.status(400).send("Imagem não foi enviada corretamente")
    return
  }

  const image = `https://storage.googleapis.com/${BUCKET}/${upload.filename}`

  try {
    const updateFotoQuery = "UPDATE Nucleo SET fotoCapa = ? WHERE ID = ?"
    connection.query(updateFotoQuery, [image, id], async (err, result) => {
      if (err) {
        console.log(err)
        return res.status(500).send("Erro ao atualizar a foto do núcleo")
      }
      return res.status(200).send("Foto do núcleo atualizada com sucesso")
    })
  } catch (error) {
    console.log(error)
    return res.status(500).send("Erro ao atualizar a foto do núcleo")
  }
}

const interestFoundingNucleo = async (req, res) => {
  const { name, email, city, history } = req.body

  if (!name || !email || !city || !history) {
    return res.status(400).send({ error: "Todos os campos são obrigatórios." })
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_TRANSPORTER,
      pass: process.env.PASSWORD_TRANSPORTER,
    },
  })

  const mailOptions = {
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
  }

  try {
    const info = await transporter.sendMail(mailOptions)
    console.log("Email enviado: " + info.response)
    res.send("success")
  } catch (error) {
    console.log(error)
    res.status(500).send("error")
  }
}

const GetNucleosAprovados = async (req, res) => {
  try {
    const sql = `
      SELECT ID, Nome, Email, Cidade, Descricao, DataFundacao, fotoCapa,
             linkDoacao, linkSite, linkLinkedin, linkFacebook, linkInstagram,
             subdominio,
             (SELECT COUNT(*) FROM Projetos WHERE NucleoResponsavel = Nucleo.ID) as totalProjetos
      FROM Nucleo 
      WHERE status = 'approved'
      ORDER BY Nome ASC
    `

    connection.query(sql, (err, results) => {
      if (err) {
        console.error("Error fetching approved nucleos:", err)
        return res.status(500).json({
          success: false,
          message: "Erro ao buscar núcleos aprovados",
        })
      }

      res.json({
        success: true,
        data: results,
        total: results.length,
      })
    })
  } catch (error) {
    console.error("Error in GetNucleosAprovados:", error)
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
    })
  }
}

const putNucleoWithoutFile = (req, res) => {
  const nucleoId = req.params.id
  const {
    Nome,
    Email,
    Cidade,
    Descricao,
    DataFundacao,
    fotoCapa,
    foto1,
    foto2,
    foto3,
    linkDoacao,
    linkSite,
    linkLinkedin,
    linkFacebook,
    linkInstagram,
  } = req.body

  // Verificar se o ID do núcleo está presente
  if (!nucleoId) {
    return res.status(400).json({
      success: false,
      message: "ID do núcleo é obrigatório",
    })
  }

  // Verificar se o núcleo existe
  const checkNucleoQuery = "SELECT * FROM Nucleo WHERE ID = ?"
  connection.query(checkNucleoQuery, [nucleoId], (error, results) => {
    if (error) {
      console.error("Erro ao verificar núcleo:", error)
      return res.status(500).json({
        success: false,
        message: "Erro ao verificar núcleo",
      })
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Núcleo não encontrado",
      })
    }

    // Atualizar todos os campos fornecidos
    const updateQuery = `
      UPDATE Nucleo SET 
        Nome = COALESCE(?, Nome),
        Email = COALESCE(?, Email),
        Cidade = COALESCE(?, Cidade),
        Descricao = COALESCE(?, Descricao),
        DataFundacao = COALESCE(?, DataFundacao),
        fotoCapa = COALESCE(?, fotoCapa),
        foto1 = COALESCE(?, foto1),
        foto2 = COALESCE(?, foto2),
        foto3 = COALESCE(?, foto3),
        linkDoacao = COALESCE(?, linkDoacao),
        linkSite = COALESCE(?, linkSite),
        linkLinkedin = COALESCE(?, linkLinkedin),
        linkFacebook = COALESCE(?, linkFacebook),
        linkInstagram = COALESCE(?, linkInstagram)
      WHERE ID = ?
    `

    connection.query(
      updateQuery,
      [
        Nome,
        Email,
        Cidade,
        Descricao,
        DataFundacao,
        fotoCapa,
        foto1,
        foto2,
        foto3,
        linkDoacao,
        linkSite,
        linkLinkedin,
        linkFacebook,
        linkInstagram,
        nucleoId,
      ],
      (error, results) => {
        if (error) {
          console.error("Erro ao atualizar núcleo:", error)
          return res.status(500).json({
            success: false,
            message: "Erro ao atualizar núcleo",
          })
        }

        res.status(200).json({
          success: true,
          message: "Núcleo atualizado com sucesso",
          data: {
            nucleoId,
            affectedRows: results.affectedRows,
          },
        })
      },
    )
  })
}

module.exports = {
  CreateNucleo,
  CreateNucleoByAdmin,
  LoginNucleo,
  GetAllNucleos,
  GetNucleoById,
  updateNucleoStatus,
  patchNucleo,
  putNucleoWithoutFile,
  updateNucleoFoto,
  deleteNucleo,
  interestFoundingNucleo,
  GetNucleosAprovados,
}
