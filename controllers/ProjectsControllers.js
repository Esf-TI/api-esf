const prisma = require("../lib/prismaClient")

const createProject = async (req, res) => {
  const { Nome, NucleoResponsavel, Area, descricao, PessoasImpactadas, DataFundacao, Cidade } = req.body
  const uploads = req.files

  if (!Nome || !descricao || !NucleoResponsavel || !PessoasImpactadas || !DataFundacao || !Cidade) {
    return res.status(400).send("Todos os campos são obrigatórios")
  }

  if (NucleoResponsavel === "undefined" || isNaN(NucleoResponsavel)) {
    return res.status(400).send("ID do núcleo responsável é inválido")
  }

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const dataDate = new Date(DataFundacao); dataDate.setHours(0, 0, 0, 0)
  if (dataDate > hoje) return res.status(400).send("Data de fundação não pode ser no futuro")

  try {
    const nucleo = await prisma.nucleo.findUnique({ where: { id: Number(NucleoResponsavel) } })
    if (!nucleo) return res.status(400).send("Núcleo responsável não encontrado")

    const fotoCapa = uploads?.fotoCapa ? uploads.fotoCapa[0]?.publicUrl ?? null : null

    await prisma.projeto.create({
      data: {
        Nome,
        NucleoResponsavel: Number(NucleoResponsavel),
        Descricao: descricao,
        Area: Area || null,
        PessoasImpactadas: Number(PessoasImpactadas),
        DataFundacao: new Date(DataFundacao),
        Cidade,
        fotoCapa,
      },
    })

    res.status(200).send("Projeto criado com sucesso!")
  } catch (error) {
    console.error("Erro ao criar Projeto:", error)
    res.status(500).send("Erro ao criar Projeto")
  }
}

const createProjectDentro = async (req, res) => {
  const { Nome, NucleoResponsavel, Area, Descricao, PessoasImpactadas, DataInicio, Cidade, fotoCapa } = req.body

  if (!Nome || !Descricao || !NucleoResponsavel || !fotoCapa || !PessoasImpactadas || !DataInicio || !Cidade) {
    return res.status(400).send("Todos os campos são obrigatórios")
  }

  if (NucleoResponsavel === "undefined" || isNaN(NucleoResponsavel)) {
    return res.status(400).send("ID do núcleo responsável é inválido")
  }

  try {
    const nucleo = await prisma.nucleo.findUnique({ where: { id: Number(NucleoResponsavel) } })
    if (!nucleo) return res.status(400).send("Núcleo responsável não encontrado")

    await prisma.projeto.create({
      data: {
        Nome,
        NucleoResponsavel: Number(NucleoResponsavel),
        Descricao,
        Area: Area || null,
        PessoasImpactadas: Number(PessoasImpactadas),
        DataFundacao: new Date(DataInicio),
        Cidade,
        fotoCapa,
      },
    })

    res.status(200).send("Projeto criado com sucesso!")
  } catch (error) {
    console.error("Erro ao criar Projeto:", error)
    res.status(500).send("Erro ao criar Projeto")
  }
}

const returnProjects = async (req, res) => {
  try {
    const projetos = await prisma.projeto.findMany()

    const projetosPorArea = {}
    projetos.forEach((p) => {
      const area = p.Area || "Sem Área"
      if (!projetosPorArea[area]) projetosPorArea[area] = []
      projetosPorArea[area].push(p)
    })

    const result = Object.keys(projetosPorArea).map((area) => ({ area, projetos: projetosPorArea[area] }))
    res.status(200).json(result)
  } catch (error) {
    console.error("Erro ao buscar projetos:", error)
    res.status(500).send("Erro ao buscar projetos")
  }
}

const returnProjectsNucleo = async (req, res) => {
  const nucleoId = Number(req.params.nucleoId)

  try {
    const projetos = await prisma.projeto.findMany({ where: { NucleoResponsavel: nucleoId } })

    if (projetos.length === 0) {
      return res.status(404).send("Nenhum projeto encontrado para este núcleo.")
    }

    const projetosPorArea = {}
    projetos.forEach((p) => {
      const area = p.Area || "Sem Área"
      if (!projetosPorArea[area]) projetosPorArea[area] = []
      projetosPorArea[area].push(p)
    })

    const result = Object.keys(projetosPorArea).map((area) => ({ area, projetos: projetosPorArea[area] }))
    res.status(200).json(result)
  } catch (error) {
    console.error("Erro ao buscar projetos:", error)
    res.status(500).send("Erro ao buscar projetos")
  }
}

const returnProjectById = async (req, res) => {
  try {
    const projeto = await prisma.projeto.findUnique({ where: { id: Number(req.params.id) } })
    if (!projeto) return res.status(404).send("Projeto não encontrado")
    res.status(200).json(projeto)
  } catch (error) {
    console.error("Erro ao buscar o projeto:", error)
    res.status(500).send("Erro ao buscar o projeto")
  }
}

const editProjectById = async (req, res) => {
  const projectId = Number(req.params.id)
  const { Nome, NucleoResponsavel, Area, descricao, PessoasImpactadas, DataFundacao, Cidade } = req.body
  const uploads = req.files

  if (!projectId || !Nome || !descricao || !NucleoResponsavel || !uploads || !PessoasImpactadas || !DataFundacao || !Cidade) {
    return res.status(400).send("Todos os campos são obrigatórios")
  }

  try {
    const existing = await prisma.projeto.findUnique({ where: { id: projectId } })
    if (!existing) return res.status(404).send("Projeto não encontrado")

    const fotoCapa = uploads.fotoCapa?.publicUrl ?? null
    const fotosUrls = (uploads.foto || []).map((f) => f.publicUrl)

    await prisma.projeto.update({
      where: { id: projectId },
      data: {
        Nome,
        NucleoResponsavel: Number(NucleoResponsavel),
        Descricao: descricao,
        Area: Area || null,
        PessoasImpactadas: Number(PessoasImpactadas),
        DataFundacao: new Date(DataFundacao),
        Cidade,
        fotoCapa,
        foto1: fotosUrls[0] ?? null,
        foto2: fotosUrls[1] ?? null,
        foto3: fotosUrls[2] ?? null,
        foto4: fotosUrls[3] ?? null,
        foto5: fotosUrls[4] ?? null,
      },
    })

    res.status(200).send("Projeto editado com sucesso!")
  } catch (error) {
    console.error("Erro ao editar Projeto:", error)
    res.status(500).send("Erro ao editar Projeto")
  }
}

const editProjectByIdWithout = async (req, res) => {
  const projectId = Number(req.params.id)
  const { Nome, NucleoResponsavel, Area, Descricao, PessoasImpactadas, DataFundacao, Cidade, fotoCapa, foto1, foto2, foto3, foto4, foto5 } = req.body

  if (!projectId) return res.status(400).send("Id é obrigatório")
  if (!Nome) return res.status(400).send("Nome é obrigatório")
  if (!Descricao) return res.status(400).send("Descrição é obrigatória")
  if (!NucleoResponsavel) return res.status(400).send("Núcleo é obrigatório")
  if (!PessoasImpactadas) return res.status(400).send("Impacto é obrigatório")
  if (!DataFundacao) return res.status(400).send("Data de fundação é obrigatória")
  if (!Cidade) return res.status(400).send("Cidade é obrigatória")

  try {
    const existing = await prisma.projeto.findUnique({ where: { id: projectId } })
    if (!existing) return res.status(404).send("Projeto não encontrado")

    await prisma.projeto.update({
      where: { id: projectId },
      data: {
        Nome,
        NucleoResponsavel: Number(NucleoResponsavel),
        Descricao,
        Area: Area || null,
        PessoasImpactadas: Number(PessoasImpactadas),
        DataFundacao: new Date(DataFundacao),
        Cidade,
        fotoCapa: fotoCapa || null,
        foto1: foto1 || null,
        foto2: foto2 || null,
        foto3: foto3 || null,
        foto4: foto4 || null,
        foto5: foto5 || null,
      },
    })

    res.status(200).json({ message: "Projeto editado com sucesso!", projectId })
  } catch (error) {
    console.error("Erro ao editar Projeto:", error)
    res.status(500).send("Erro ao editar Projeto")
  }
}

const patchProject = async (req, res) => {
  const projectId = Number(req.params.id)
  const { campoAAlterar, novoValor } = req.body

  if (!projectId || !campoAAlterar || !novoValor) {
    return res.status(400).send("O ID do projeto, o campo a ser alterado e o novo valor são obrigatórios")
  }

  const allowedFields = ["Nome", "Area", "Descricao", "PessoasImpactadas", "Cidade", "status", "fotoCapa", "foto1", "foto2", "foto3", "foto4", "foto5"]
  if (!allowedFields.includes(campoAAlterar)) {
    return res.status(400).send("Campo não permitido para atualização")
  }

  try {
    const existing = await prisma.projeto.findUnique({ where: { id: projectId } })
    if (!existing) return res.status(404).send("Projeto não encontrado")

    await prisma.projeto.update({ where: { id: projectId }, data: { [campoAAlterar]: novoValor } })
    res.status(200).send(`Campo ${campoAAlterar} do projeto ${projectId} atualizado com sucesso!`)
  } catch (error) {
    console.error("Erro ao atualizar campo do projeto:", error)
    res.status(500).send("Erro ao atualizar campo do projeto")
  }
}

const updatePhotoCapaProjeto = async (req, res) => {
  const projectId = Number(req.params.id)
  const upload = req.file

  if (!upload || !upload.publicUrl) {
    return res.status(400).send("Imagem não foi enviada corretamente")
  }

  try {
    await prisma.projeto.update({ where: { id: projectId }, data: { fotoCapa: upload.publicUrl } })
    return res.status(200).send("Foto do núcleo atualizada com sucesso")
  } catch (error) {
    console.error(error)
    return res.status(500).send("Erro ao atualizar a foto do núcleo")
  }
}

const deleteProjectById = async (req, res) => {
  const projectId = Number(req.params.id)

  try {
    await prisma.projeto.delete({ where: { id: projectId } })
    res.status(200).send("Projeto excluído com sucesso!")
  } catch (error) {
    if (error.code === "P2025") return res.status(404).send("Projeto não encontrado")
    console.error("Erro ao excluir o projeto:", error)
    res.status(500).send("Erro ao excluir o projeto")
  }
}

module.exports = {
  createProject,
  createProjectDentro,
  editProjectByIdWithout,
  returnProjects,
  returnProjectById,
  editProjectById,
  deleteProjectById,
  patchProject,
  returnProjectsNucleo,
  updatePhotoCapaProjeto,
}
