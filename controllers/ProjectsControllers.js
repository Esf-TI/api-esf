const prisma = require("../lib/prismaClient")
const { parseDataLocal, isDataFutura } = require("../lib/dates")

const createProject = async (req, res) => {
  const { Nome, NucleoResponsavel, Area, descricao, PessoasImpactadas, DataFundacao, Cidade } = req.body
  const uploads = req.files

  // PessoasImpactadas usa checagem explícita: `!PessoasImpactadas` barrava o valor 0.
  if (!Nome || !descricao || !NucleoResponsavel || PessoasImpactadas === undefined || PessoasImpactadas === null || PessoasImpactadas === "" || !DataFundacao || !Cidade) {
    return res.status(400).send("Todos os campos são obrigatórios")
  }

  if (NucleoResponsavel === "undefined" || isNaN(NucleoResponsavel)) {
    return res.status(400).send("ID do núcleo responsável é inválido")
  }

  const dataFundacao = parseDataLocal(DataFundacao)
  if (!dataFundacao) return res.status(400).send("Data de fundação inválida")
  if (isDataFutura(dataFundacao)) return res.status(400).send("Data de fundação não pode ser no futuro")

  try {
    const nucleo = await prisma.nucleo.findUnique({ where: { id: Number(NucleoResponsavel) } })
    if (!nucleo) return res.status(400).send("Núcleo responsável não encontrado")

    // uploads.fotoCapa já é o objeto { filename, publicUrl } após uploadsProjects middleware
    const fotoCapa = uploads?.fotoCapa?.publicUrl ?? null
    // As fotos extras já foram enviadas ao storage pelo middleware; sem isto elas
    // eram pagas em storage e descartadas (só o edit as gravava).
    const fotosUrls = (uploads?.foto || []).map((f) => f.publicUrl)

    await prisma.projeto.create({
      data: {
        Nome,
        NucleoResponsavel: Number(NucleoResponsavel),
        Descricao: descricao,
        Area: Area || null,
        PessoasImpactadas: Number(PessoasImpactadas),
        DataFundacao: dataFundacao,
        Cidade,
        fotoCapa,
        foto1: fotosUrls[0] ?? null,
        foto2: fotosUrls[1] ?? null,
        foto3: fotosUrls[2] ?? null,
        foto4: fotosUrls[3] ?? null,
        foto5: fotosUrls[4] ?? null,
      },
    })

    res.status(200).send("Projeto criado com sucesso!")
  } catch (error) {
    console.error("Erro ao criar Projeto:", error)
    res.status(500).send("Erro ao criar Projeto")
  }
}

const createProjectDentro = async (req, res) => {
  const { Nome, NucleoResponsavel, Area, Descricao, PessoasImpactadas, DataInicio, Cidade, fotoCapa, foto1, foto2, foto3 } = req.body

  if (
    !Nome ||
    !Descricao ||
    !NucleoResponsavel ||
    !fotoCapa ||
    PessoasImpactadas === undefined ||
    PessoasImpactadas === null ||
    PessoasImpactadas === "" ||
    !DataInicio ||
    !Cidade
  ) {
    return res.status(400).send("Todos os campos são obrigatórios")
  }

  if (NucleoResponsavel === "undefined" || isNaN(NucleoResponsavel)) {
    return res.status(400).send("ID do núcleo responsável é inválido")
  }

  const dataInicioParsed = parseDataLocal(DataInicio)
  if (!dataInicioParsed) return res.status(400).send("Data de início inválida")

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
        DataFundacao: dataInicioParsed,
        Cidade,
        fotoCapa,
        foto1: foto1 || null,
        foto2: foto2 || null,
        foto3: foto3 || null,
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
    const projetos = await prisma.projeto.findMany({ orderBy: { id: "desc" } })

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

const { resolveNucleoIdFromParam } = require("../lib/nucleoSlug")

const returnProjectsNucleo = async (req, res) => {
  try {
    const nucleoId = await resolveNucleoIdFromParam(req.params.nucleoId)
    if (!nucleoId) {
      return res.status(404).send("Núcleo não encontrado.")
    }

    const projetos = await prisma.projeto.findMany({ where: { NucleoResponsavel: nucleoId } })

    // Núcleo sem projetos é uma coleção VAZIA, não um 404. O 404 aqui derrubava
    // a página inteira do núcleo (o front busca núcleo e projetos juntos), então
    // todo núcleo recém-criado aparecia como "Núcleo não encontrado".
    if (projetos.length === 0) {
      return res.status(200).json([])
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

  if (!projectId || !Nome || !descricao || !NucleoResponsavel || PessoasImpactadas === undefined || PessoasImpactadas === null || PessoasImpactadas === "" || !DataFundacao || !Cidade) {
    return res.status(400).send("Todos os campos são obrigatórios")
  }

  const dataFundacaoDate = parseDataLocal(DataFundacao)
  if (!dataFundacaoDate) return res.status(400).send("Data de fundação inválida")

  try {
    const existing = await prisma.projeto.findUnique({ where: { id: projectId } })
    if (!existing) return res.status(404).send("Projeto não encontrado")

    // Manter imagens existentes se não foram enviadas novas
    const fotoCapa = uploads?.fotoCapa?.publicUrl ?? existing.fotoCapa
    const fotosUrls = (uploads?.foto || []).map((f) => f.publicUrl)

    await prisma.projeto.update({
      where: { id: projectId },
      data: {
        Nome,
        NucleoResponsavel: Number(NucleoResponsavel),
        Descricao: descricao,
        Area: Area || null,
        PessoasImpactadas: Number(PessoasImpactadas),
        DataFundacao: dataFundacaoDate,
        Cidade,
        fotoCapa,
        // Preservar fotos existentes se não foram enviadas novas
        foto1: fotosUrls[0] ?? existing.foto1,
        foto2: fotosUrls[1] ?? existing.foto2,
        foto3: fotosUrls[2] ?? existing.foto3,
        foto4: fotosUrls[3] ?? existing.foto4,
        foto5: fotosUrls[4] ?? existing.foto5,
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
  const {
    Nome,
    NucleoResponsavel,
    Area,
    Descricao,
    PessoasImpactadas,
    DataFundacao: dataFundacaoBody,
    DataInicio,
    Cidade,
    fotoCapa,
    foto1,
    foto2,
    foto3,
    foto4,
    foto5,
  } = req.body

  const dataFundacaoVal = dataFundacaoBody || DataInicio

  if (!projectId) return res.status(400).send("Id é obrigatório")
  if (!Nome) return res.status(400).send("Nome é obrigatório")
  if (!Descricao) return res.status(400).send("Descrição é obrigatória")
  if (NucleoResponsavel === undefined || NucleoResponsavel === null || NucleoResponsavel === "") {
    return res.status(400).send("Núcleo é obrigatório")
  }
  if (PessoasImpactadas === undefined || PessoasImpactadas === null || PessoasImpactadas === "") {
    return res.status(400).send("Impacto é obrigatório")
  }
  if (!dataFundacaoVal) return res.status(400).send("Data de fundação é obrigatória")
  if (!Cidade) return res.status(400).send("Cidade é obrigatória")

  const dataFundacaoDate = parseDataLocal(dataFundacaoVal)
  if (!dataFundacaoDate) {
    return res.status(400).send("Data de fundação inválida")
  }

  try {
    const existing = await prisma.projeto.findUnique({ where: { id: projectId } })
    if (!existing) return res.status(404).send("Projeto não encontrado")

    // Só sobrescreve a foto quando o campo VEM no corpo. Antes, `foto || null`
    // apagava todas as imagens sempre que o formulário salvava sem reenviá-las
    // (ex.: editar apenas o nome do projeto zerava a galeria).
    const manterFoto = (novo, atual) => (novo !== undefined ? novo || null : atual)

    const updated = await prisma.projeto.update({
      where: { id: projectId },
      data: {
        Nome,
        NucleoResponsavel: Number(NucleoResponsavel),
        Descricao,
        Area: Area || null,
        PessoasImpactadas: Number(PessoasImpactadas),
        DataFundacao: dataFundacaoDate,
        Cidade,
        fotoCapa: manterFoto(fotoCapa, existing.fotoCapa),
        foto1: manterFoto(foto1, existing.foto1),
        foto2: manterFoto(foto2, existing.foto2),
        foto3: manterFoto(foto3, existing.foto3),
        foto4: manterFoto(foto4, existing.foto4),
        foto5: manterFoto(foto5, existing.foto5),
      },
    })

    res.status(200).json({ message: "Projeto editado com sucesso!", projectId, data: updated })
  } catch (error) {
    console.error("Erro ao editar Projeto:", error)
    res.status(500).send("Erro ao editar Projeto")
  }
}

const patchProject = async (req, res) => {
  const projectId = Number(req.params.id)
  const { campoAAlterar, novoValor } = req.body

  // `novoValor` só não pode ser undefined/null: com `!novoValor` era impossível
  // limpar um campo (string vazia) ou gravar PessoasImpactadas = 0.
  if (!projectId || !campoAAlterar || novoValor === undefined || novoValor === null) {
    return res.status(400).send("O ID do projeto, o campo a ser alterado e o novo valor são obrigatórios")
  }

  const allowedFields = ["Nome", "Area", "Descricao", "PessoasImpactadas", "Cidade", "status", "fotoCapa", "foto1", "foto2", "foto3", "foto4", "foto5"]
  if (!allowedFields.includes(campoAAlterar)) {
    return res.status(400).send("Campo não permitido para atualização")
  }

  try {
    const existing = await prisma.projeto.findUnique({ where: { id: projectId } })
    if (!existing) return res.status(404).send("Projeto não encontrado")

    // Campo numérico chega como string no corpo; converte para o Prisma aceitar.
    const valorFinal = campoAAlterar === "PessoasImpactadas" ? Number(novoValor) : novoValor
    if (campoAAlterar === "PessoasImpactadas" && !Number.isFinite(valorFinal)) {
      return res.status(400).send("PessoasImpactadas deve ser um número")
    }

    await prisma.projeto.update({ where: { id: projectId }, data: { [campoAAlterar]: valorFinal } })
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
