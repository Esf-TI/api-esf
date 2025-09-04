const connection = require("../connection")
const BUCKET = "engenheiros-sem-fronteiras.appspot.com"

const createProject = (req, res) => {
  const { Nome, NucleoResponsavel, Area, descricao, PessoasImpactadas, DataFundacao, Cidade } = req.body
  const uploads = req.files
  console.log(req.body)

  // Verificar se todos os campos obrigatórios estão presentes
  if (!Nome || !descricao || !NucleoResponsavel || !uploads || !PessoasImpactadas || !DataFundacao || !Cidade) {
    res.status(400).send("Todos os campos são obrigatórios")
    return
  }

  if (NucleoResponsavel === "undefined" || isNaN(NucleoResponsavel)) {
    res.status(400).send("ID do núcleo responsável é inválido")
    return
  }

  const checkNucleoQuery = "SELECT ID FROM Nucleo WHERE ID = ?"
  connection.query(checkNucleoQuery, [NucleoResponsavel], (error, nucleoResults) => {
    if (error) {
      console.error("Erro ao verificar núcleo: " + error.message)
      res.status(500).send("Erro ao verificar núcleo")
      return
    }

    if (nucleoResults.length === 0) {
      res.status(400).send("Núcleo responsável não encontrado")
      return
    }

    // Núcleo existe, prosseguir com a criação do projeto
    const fotoCapa = `https://storage.googleapis.com/${BUCKET}/${uploads.fotoCapa.filename}`

    const sql =
      "INSERT INTO Projetos (Nome, NucleoResponsavel, Descricao, Area, PessoasImpactadas, DataFundacao, Cidade, fotoCapa) VALUES (?, ?, ?, ?,?, ?, ?, ?)"

    connection.query(
      sql,
      [Nome, NucleoResponsavel, descricao, Area, PessoasImpactadas, DataFundacao, Cidade, fotoCapa],
      (error, results, fields) => {
        if (error) {
          console.error("Erro ao criar Projeto: " + error.message)
          res.status(500).send("Erro ao criar Projeto")
          return
        }
        console.log("Projeto criado com sucesso!")
        res.status(200).send("Projeto criado com sucesso!")
      },
    )
  })
}

const returnProjects = (req, res) => {
  const sql = "SELECT * FROM Projetos"

  connection.query(sql, (error, results, fields) => {
    if (error) {
      console.error("Erro ao buscar projetos: " + error.message)
      res.status(500).send("Erro ao buscar projetos")
      return
    }
    // Objeto para armazenar os projetos agrupados por área
    const projetosPorArea = {}

    // Organizando os projetos por área
    results.forEach((projeto) => {
      const {
        Area,
        Nome,
        fotoCapa,
        Id,
        Descricao,
        NucleoResponsavel,
        DataFundacao,
        Cidade,
        foto1,
        foto2,
        foto3,
        foto4,
        foto5,
      } = projeto

      if (!projetosPorArea[Area]) {
        projetosPorArea[Area] = []
      }

      projetosPorArea[Area].push({
        Nome,
        fotoCapa,
        Id,
        Descricao,
        NucleoResponsavel,
        DataFundacao,
        Cidade,
        foto1,
        foto2,
        foto3,
        foto4,
        foto5,
      })
    })

    const projetosAgrupados = Object.keys(projetosPorArea).map((area) => ({
      area,
      projetos: projetosPorArea[area],
    }))
    res.status(200).json(projetosAgrupados) // Retorna os projetos organizados por área
  })
}

const returnProjectsNucleo = (req, res) => {
  const nucleoId = req.params.nucleoId // Obtém o ID do núcleo logado

  const sql = "SELECT * FROM Projetos WHERE NucleoResponsavel = ?" // Consulta SQL filtrando pelo NucleoResponsavel

  connection.query(sql, [nucleoId], (error, results, fields) => {
    if (error) {
      console.error("Erro ao buscar projetos: " + error.message)
      res.status(500).send("Erro ao buscar projetos")
      return
    }

    // Verifica se há projetos encontrados
    if (results.length === 0) {
      res.status(404).send("Nenhum projeto encontrado para este núcleo.")
      return
    }

    // Objeto para armazenar os projetos agrupados por área
    const projetosPorArea = {}

    // Organizando os projetos por área
    results.forEach((projeto) => {
      const {
        Area,
        Nome,
        fotoCapa,
        ID,
        Descricao,
        NucleoResponsavel,
        DataFundacao,
        Cidade,
        foto1,
        foto2,
        foto3,
        foto4,
        foto5,
      } = projeto

      if (!projetosPorArea[Area]) {
        projetosPorArea[Area] = []
      }

      projetosPorArea[Area].push({
        Nome,
        fotoCapa,
        ID,
        Descricao,
        NucleoResponsavel,
        DataFundacao,
        Cidade,
        foto1,
        foto2,
        foto3,
        foto4,
        foto5,
      })
    })

    const projetosAgrupados = Object.keys(projetosPorArea).map((area) => ({
      area,
      projetos: projetosPorArea[area],
    }))
    res.status(200).json(projetosAgrupados) // Retorna os projetos organizados por área
  })
}

// retorna o projeto pelo id
const returnProjectById = (req, res) => {
  const projectId = req.params.id // Obtém o ID do projeto a partir dos parâmetros da rota
  console.log(projectId)
  const sql = "SELECT * FROM Projetos WHERE id = ?"

  connection.query(sql, [projectId], (error, results, fields) => {
    if (error) {
      console.error("Erro ao buscar o projeto: " + error.message)
      res.status(500).send("Erro ao buscar o projeto")
      return
    }

    if (results.length === 0) {
      res.status(404).send("Projeto não encontrado")
      return
    }

    console.log("Projeto encontrado:", results[0])
    res.status(200).json(results[0]) // Retorna o projeto encontrado como JSON
  })
}

//editar um projeto
const editProjectById = (req, res) => {
  const projectId = req.params.id // Obtenha o ID do projeto a ser editado
  const { Nome, NucleoResponsavel, Area, descricao, PessoasImpactadas, DataFundacao, Cidade } = req.body
  const uploads = req.files

  // Verificar se todos os campos obrigatórios estão presentes
  if (
    !projectId ||
    !Nome ||
    !descricao ||
    !NucleoResponsavel ||
    !uploads ||
    !PessoasImpactadas ||
    !DataFundacao ||
    !Cidade
  ) {
    res.status(400).send("Todos os campos são obrigatórios")
    return
  }

  // Verificar se o projeto com o ID fornecido existe no banco de dados
  const checkProjectQuery = "SELECT * FROM Projetos WHERE ID = ?"
  connection.query(checkProjectQuery, [projectId], (error, results) => {
    if (error) {
      console.error("Erro ao verificar projeto: " + error.message)
      res.status(500).send("Erro ao verificar projeto")
      return
    }

    // Verificar se o projeto com o ID fornecido foi encontrado
    if (results.length === 0) {
      res.status(404).send("Projeto não encontrado")
      return
    }

    // Atualizar o projeto com os novos dados
    const fotoCapa = `https://storage.googleapis.com/${BUCKET}/${uploads.fotoCapa.filename}`
    const fotos = uploads.foto.map((upload) => `https://storage.googleapis.com/${BUCKET}/${upload.filename}`)

    const fotosNumeradas = {
      foto1: null,
      foto2: null,
      foto3: null,
      foto4: null,
      foto5: null,
    }

    fotos.slice(0, 5).forEach((foto, index) => {
      fotosNumeradas[`foto${index + 1}`] = foto
    })

    // Extrair os valores dos URLs das fotos numeradas
    const valoresFotosNumeradas = Object.values(fotosNumeradas)

    // Atualizar os dados do projeto no banco de dados
    const updateProjectQuery =
      "UPDATE Projetos SET Nome = ?, NucleoResponsavel = ?, Descricao = ?, Area = ?, PessoasImpactadas = ?, DataFundacao = ?, Cidade = ?, fotoCapa = ?, foto1 = ?, foto2 = ?, foto3 = ?, foto4 = ?, foto5 = ? WHERE ID = ?"
    const params = [
      Nome,
      NucleoResponsavel,
      descricao,
      Area,
      PessoasImpactadas,
      DataFundacao,
      Cidade,
      fotoCapa,
      ...valoresFotosNumeradas,
      projectId,
    ]

    connection.query(updateProjectQuery, params, (error, results) => {
      if (error) {
        console.error("Erro ao editar Projeto: " + error.message)
        res.status(500).send("Erro ao editar Projeto")
        return
      }
      console.log("Projeto editado com sucesso!")
      res.status(200).send("Projeto editado com sucesso!")
    })
  })
}

const patchProject = (req, res) => {
  const projectId = req.params.id // Obtenha o ID do projeto a ser editado
  const { campoAAlterar, novoValor } = req.body
  console.log(campoAAlterar, novoValor)
  // Verificar se todos os campos obrigatórios estão presentes
  if (!projectId || !campoAAlterar || !novoValor) {
    res.status(400).send("O ID do projeto, o campo a ser alterado e o novo valor são obrigatórios")
    return
  }

  // Verificar se o projeto com o ID fornecido existe no banco de dados
  const checkProjectQuery = "SELECT * FROM Projetos WHERE ID = ?"
  connection.query(checkProjectQuery, [projectId], (error, results) => {
    if (error) {
      console.error("Erro ao verificar projeto: " + error.message)
      res.status(500).send("Erro ao verificar projeto")
      return
    }

    // Verificar se o projeto com o ID fornecido foi encontrado
    if (results.length === 0) {
      res.status(404).send("Projeto não encontrado")
      return
    }

    // Atualizar o campo específico do projeto no banco de dados
    const updateFieldQuery = `UPDATE Projetos SET ${campoAAlterar} = ? WHERE ID = ?`
    connection.query(updateFieldQuery, [novoValor, projectId], (error, results) => {
      if (error) {
        console.error("Erro ao atualizar campo do projeto: " + error.message)
        res.status(500).send("Erro ao atualizar campo do projeto")
        return
      }
      console.log(`Campo ${campoAAlterar} do projeto ${projectId} atualizado com sucesso!`)
      res.status(200).send(`Campo ${campoAAlterar} do projeto ${projectId} atualizado com sucesso!`)
    })
  })
}
const updatePhotoCapaProjeto = async (req, res) => {
  const { id } = req.params
  const upload = req.file
  console.log("id: " + id)
  // Assegurar que a imagem foi enviada corretamente
  if (!upload || !upload.filename) {
    res.status(400).send("Imagem não foi enviada corretamente")
    return
  }

  const image = `https://storage.googleapis.com/${BUCKET}/${upload.filename}`

  try {
    const updateFotoQuery = "UPDATE Projetos SET fotoCapa = ? WHERE ID = ?"
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
const deleteProjectById = (req, res) => {
  const projectId = req.params.id // Obtém o ID do projeto a partir dos parâmetros da rota

  const sql = "DELETE FROM Projetos WHERE id = ?"

  connection.query(sql, [projectId], (error, results, fields) => {
    if (error) {
      console.error("Erro ao excluir o projeto: " + error.message)
      res.status(500).send("Erro ao excluir o projeto")
      return
    }

    if (results.affectedRows === 0) {
      res.status(404).send("Projeto não encontrado")
      return
    }

    console.log("Projeto excluído com sucesso!")
    res.status(200).send("Projeto excluído com sucesso!")
  })
}

module.exports = {
  createProject,
  returnProjects,
  returnProjectById,
  editProjectById,
  deleteProjectById,
  patchProject,
  returnProjectsNucleo,
  updatePhotoCapaProjeto,
}
