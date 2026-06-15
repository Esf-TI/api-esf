const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const nodemailer = require("nodemailer")
const prisma = require("../lib/prismaClient")
const { generateTokens, refreshAccessToken } = require("../middlewares/authFunctions")
const {
  buildNucleoSlug,
  assignSlugsToList,
  resolveNucleoFromParam,
  NUCLEO_PUBLIC_SELECT,
  NUCLEO_ADMIN_SELECT,
} = require("../lib/nucleoSlug")
const { getPagination } = require("../lib/pagination")
require("dotenv").config()

/** Piso para displayTotal quando há poucos cadastros aprovados (alinhado ao `DEFAULT_NUCLEOS_EXIBICAO_PISO` no front). */
const DEFAULT_NUCLEOS_EXIBICAO_PISO = 35

// WordPress/cPanel standby — mantido para uso futuro
// const { createSubdomain } = require("../middlewares/domainFunctions")

const validateNucleoData = (data) => {
  const errors = []
  const requiredFields = ["email", "senha", "nomeNucleo", "descricao", "cidade", "estado", "dataFundacao"]

  requiredFields.forEach((field) => {
    if (!data[field] || data[field].toString().trim() === "") {
      errors.push(`${field} é obrigatório`)
    }
  })

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (data.email && !emailRegex.test(data.email)) {
    errors.push("Formato de email inválido")
  }

  if (data.senha && data.senha.length < 8) {
    errors.push("A senha deve ter pelo menos 8 caracteres")
  }

  return errors
}

const deleteNucleo = async (req, res) => {
  const nucleoId = Number(req.params.id)

  if (!nucleoId) {
    return res.status(400).send("ID do núcleo não fornecido")
  }

  try {
    await prisma.$transaction([
      prisma.nucleoToken.deleteMany({ where: { nucleoId } }),
      prisma.projeto.deleteMany({ where: { NucleoResponsavel: nucleoId } }),
      prisma.nucleo.delete({ where: { id: nucleoId } }),
    ])

    return res.status(200).json({ success: true, message: "Núcleo excluído com sucesso" })
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, message: "Núcleo não encontrado" })
    }
    console.error("Error deleting nucleo:", error)
    return res.status(500).send("Erro ao excluir o núcleo")
  }
}

const CreateNucleo = async (req, res) => {
  try {
    const { email, senha, nomeNucleo, descricao, cidade, estado, dataFundacao, linkDoacao, linkSite, linkLinkedin, linkFacebook, linkInstagram } =
      req.body

    const validationErrors = validateNucleoData({ email, senha, nomeNucleo, descricao, cidade, estado, dataFundacao })
    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, message: "Dados inválidos", errors: validationErrors })
    }

    const upload = req.file
    if (!upload || !upload.publicUrl) {
      return res.status(400).json({ success: false, message: "Imagem é obrigatória" })
    }

    const existing = await prisma.nucleo.findUnique({ where: { Email: email } })
    if (existing) {
      return res.status(409).json({ success: false, message: "E-mail já cadastrado" })
    }

    const hashedPassword = await bcrypt.hash(senha, 12)

    const nucleo = await prisma.nucleo.create({
      data: {
        Nome: nomeNucleo,
        Email: email,
        Senha: hashedPassword,
        Cidade: cidade,
        Estado: estado,
        Descricao: descricao,
        DataFundacao: new Date(dataFundacao),
        fotoCapa: upload.publicUrl,
        linkDoacao: linkDoacao || null,
        linkSite: linkSite || null,
        linkLinkedin: linkLinkedin || null,
        linkFacebook: linkFacebook || null,
        linkInstagram: linkInstagram || null,
        status: "pending",
        subdominio: buildNucleoSlug({
          Nome: nomeNucleo,
          Cidade: cidade,
          Estado: estado,
        }),
      },
    })

    const { logAdminAction } = require("./AdminController")
    await logAdminAction(null, "NUCLEO_CREATED", { nucleoId: nucleo.id, nomeNucleo: nucleo.Nome, email, cidade })

    res.status(201).json({ success: true, message: "Núcleo criado com sucesso!", data: { id: nucleo.id, nome: nucleo.Nome, status: "pending" } })
  } catch (error) {
    console.error("Error creating nucleo:", error)
    res.status(500).json({ success: false, message: "Erro interno do servidor" })
  }
}

const CreateNucleoByAdmin = async (req, res) => {
  try {
    const { email, senha, nomeNucleo, descricao, cidade, estado = "", dataFundacao, linkDoacao = "", linkSite = "", linkLinkedin = "", linkFacebook = "", linkInstagram = "" } = req.body

    const requiredFields = ["email", "senha", "nomeNucleo", "cidade"]
    const missingFields = requiredFields.filter((field) => !req.body[field] || req.body[field].toString().trim() === "")
    if (missingFields.length > 0) {
      return res.status(400).json({ success: false, message: "Campos obrigatórios faltando", errors: missingFields.map((f) => `${f} é obrigatório`) })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Formato de email inválido" })
    }

    if (senha.length < 8) {
      return res.status(400).json({ success: false, message: "A senha deve ter pelo menos 8 caracteres" })
    }

    if (dataFundacao) {
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
      const dataDate = new Date(dataFundacao); dataDate.setHours(0, 0, 0, 0)
      if (dataDate > hoje) {
        return res.status(400).json({ success: false, message: "Data de fundação não pode ser no futuro" })
      }
    }

    const existing = await prisma.nucleo.findUnique({ where: { Email: email } })
    if (existing) {
      return res.status(409).json({ success: false, message: "Email já está em uso" })
    }

    const hashedPassword = await bcrypt.hash(senha, 12)

    const nucleo = await prisma.nucleo.create({
      data: {
        Nome: nomeNucleo,
        Email: email,
        Senha: hashedPassword,
        Cidade: cidade,
        Estado: estado,
        Descricao: descricao || `Núcleo ${nomeNucleo} criado pelo administrador`,
        DataFundacao: dataFundacao ? new Date(dataFundacao) : new Date(),
        fotoCapa: null,
        linkDoacao, linkSite, linkLinkedin, linkFacebook, linkInstagram,
        status: "approved",
        subdominio: null,
      },
    })

    res.status(201).json({ success: true, message: "Núcleo criado com sucesso pelo administrador!", data: { id: nucleo.id, nome: nucleo.Nome, email, cidade, status: "approved" } })
  } catch (error) {
    console.error("Error creating nucleo by admin:", error)
    res.status(500).json({ success: false, message: "Erro interno do servidor" })
  }
}

const LoginNucleo = async (req, res) => {
  const { email, senha } = req.body

  if (!email || !senha) {
    return res.status(400).send("Por favor, forneça o email e a senha")
  }

  try {
    const nucleo = await prisma.nucleo.findUnique({ where: { Email: email } })

    if (!nucleo) {
      return res.status(404).send("Usuário não encontrado")
    }

    const senhaCorrespondente = await bcrypt.compare(senha, nucleo.Senha)
    if (!senhaCorrespondente) {
      return res.status(401).send("Senha incorreta")
    }

    if (nucleo.status !== "approved") {
      return res.status(409).send("Nucleo nao aprovado")
    }

    const tokens = generateTokens(nucleo.id, "nucleo")

    await prisma.$transaction([
      prisma.nucleoToken.deleteMany({ where: { nucleoId: nucleo.id } }),
      prisma.nucleoToken.create({
        data: {
          nucleoId: nucleo.id,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          accessTokenExpires: tokens.accessTokenExpires,
          refreshTokenExpires: tokens.refreshTokenExpires,
        },
      }),
    ])

    res.status(200).json({
      message: "Login realizado com sucesso.",
      id: nucleo.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpires: tokens.accessTokenExpires,
      refreshTokenExpires: tokens.refreshTokenExpires,
      subdominio: nucleo.subdominio,
    })
  } catch (error) {
    console.error("Erro ao tentar fazer o login:", error)
    return res.status(500).send("Erro ao tentar fazer o login")
  }
}

const RefreshNucleoToken = async (req, res) => {
  try {
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken || req.headers["x-refresh-token"]

    if (!refreshToken) {
      return res.status(401).json({ success: false, message: "Refresh token não fornecido", code: "MISSING_REFRESH_TOKEN" })
    }

    const newTokens = await refreshAccessToken(refreshToken)

    if (newTokens) {
      res.json({ success: true, data: newTokens })
    } else {
      res.status(401).json({ success: false, message: "Token inválido ou expirado", code: "INVALID_REFRESH_TOKEN" })
    }
  } catch (error) {
    console.error("Error refreshing nucleo tokens:", error)
    res.status(500).json({ success: false, message: "Erro interno do servidor" })
  }
}

const GetAllNucleos = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, cidade, search, sortBy = "id", sortOrder = "desc" } = req.query
    const pageNum = Math.max(1, Number(page))
    const limitNum = Math.min(100, Math.max(1, Number(limit)))
    const skip = (pageNum - 1) * limitNum

    const allowedSortFields = ["id", "Nome", "Cidade", "Estado", "DataFundacao"]
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : "id"
    const safeSortOrder = sortOrder === "asc" ? "asc" : "desc"

    const where = {}
    if (status) where.status = status
    if (cidade) where.Cidade = { contains: cidade, mode: "insensitive" }
    if (search) {
      where.OR = [
        { Nome: { contains: search, mode: "insensitive" } },
        { Email: { contains: search, mode: "insensitive" } },
      ]
    }

    // Allow-list de campos: nunca devolve `Senha`/`Token`. Admin autenticado vê dados de contato.
    const select = req.admin ? NUCLEO_ADMIN_SELECT : NUCLEO_PUBLIC_SELECT

    const [total, nucleos] = await Promise.all([
      prisma.nucleo.count({ where }),
      prisma.nucleo.findMany({
        where,
        orderBy: { [safeSortBy]: safeSortOrder },
        skip,
        take: limitNum,
        select: { ...select, _count: { select: { projetos: true } } },
      }),
    ])

    const formatted = nucleos.map((n) => ({ ...n, totalProjetos: n._count.projetos }))

    res.json({ success: true, data: { nucleos: formatted, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } } })
  } catch (error) {
    console.error("Error in GetAllNucleos:", error)
    res.status(500).json({ success: false, message: "Erro interno do servidor" })
  }
}

const GetNucleoById = async (req, res) => {
  try {
    // Admins autenticados recebem campos de contato/moderação; o público, não.
    const nucleo = await resolveNucleoFromParam(req.params.id, { includePrivate: Boolean(req.admin) })
    if (!nucleo) return res.status(404).send("Núcleo não encontrado")
    const slug = buildNucleoSlug(nucleo)
    return res.status(200).json({ ...nucleo, slug })
  } catch (error) {
    console.error(error)
    return res.status(500).send("Erro ao buscar o núcleo")
  }
}

const updateNucleoStatus = async (req, res) => {
  const nucleoId = Number(req.params.id)
  const { novoStatus } = req.body

  if (!nucleoId || !novoStatus) {
    return res.status(400).json({ success: false, message: "ID do núcleo e novo status são obrigatórios" })
  }

  if (!["approved", "reproved", "pending"].includes(novoStatus)) {
    return res.status(400).json({ success: false, message: "Status deve ser: approved, reproved ou pending" })
  }

  try {
    const nucleo = await prisma.nucleo.update({
      where: { id: nucleoId },
      data: { status: novoStatus },
    })

    res.json({ success: true, message: `Núcleo ${nucleo.Nome} ${novoStatus === "approved" ? "aprovado" : "reprovado"} com sucesso`, data: { nucleoId, nucleoNome: nucleo.Nome, status: novoStatus } })
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ success: false, message: "Núcleo não encontrado" })
    console.error("Error updating nucleo status:", error)
    res.status(500).json({ success: false, message: "Erro ao atualizar status do núcleo" })
  }
}

const patchNucleo = async (req, res) => {
  const nucleoId = Number(req.params.id)
  const { campoAAlterar, novoValor } = req.body

  if (!nucleoId || !campoAAlterar || !novoValor) {
    return res.status(400).send("O ID do núcleo, o campo a ser alterado e o novo valor são obrigatórios")
  }

  const allowedFields = ["Nome", "Email", "Cidade", "Estado", "Descricao", "DataFundacao", "fotoCapa", "foto1", "foto2", "foto3", "linkDoacao", "linkSite", "linkLinkedin", "linkFacebook", "linkInstagram", "status"]
  if (!allowedFields.includes(campoAAlterar)) {
    return res.status(400).send("Campo não permitido para atualização")
  }

  try {
    await prisma.nucleo.update({ where: { id: nucleoId }, data: { [campoAAlterar]: novoValor } })
    res.status(200).send(`Campo ${campoAAlterar} do núcleo ${nucleoId} atualizado com sucesso!`)
  } catch (error) {
    if (error.code === "P2025") return res.status(404).send("Núcleo não encontrado")
    console.error("Erro ao atualizar campo do núcleo:", error)
    res.status(500).send("Erro ao atualizar campo do núcleo")
  }
}

const updateNucleoFoto = async (req, res) => {
  const nucleoId = Number(req.params.id)
  const upload = req.file

  if (!upload || !upload.publicUrl) {
    return res.status(400).send("Imagem não foi enviada corretamente")
  }

  try {
    await prisma.nucleo.update({ where: { id: nucleoId }, data: { fotoCapa: upload.publicUrl } })
    return res.status(200).send("Foto do núcleo atualizada com sucesso")
  } catch (error) {
    console.error(error)
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
    auth: { user: process.env.EMAIL_TRANSPORTER, pass: process.env.PASSWORD_TRANSPORTER },
  })

  const mailOptions = {
    from: process.env.EMAIL_TRANSPORTER,
    to: process.env.FINAL_EMAIL,
    subject: `Mensagem de ${name} fundar nucleo`,
    text: `${name} está interessado em fundar um núcleo!\n\nCidade: ${city}\n\nMensagem: ${history}`,
  }

  // Envia o e-mail fora do caminho da resposta: não bloqueia o cliente esperando o SMTP.
  transporter
    .sendMail(mailOptions)
    .catch((error) => console.error("[interestFoundingNucleo] Falha ao enviar e-mail:", error.message))

  return res.send("success")
}

const GetNucleosAprovados = async (req, res) => {
  try {
    const pag = getPagination(req.query)
    const [nucleos, totalCadastrados] = await Promise.all([
      prisma.nucleo.findMany({
        where: { status: "approved" },
        orderBy: { Nome: "asc" },
        // Endpoint público: somente campos públicos (sem `Senha`/`Email`/`Token`).
        select: { ...NUCLEO_PUBLIC_SELECT, _count: { select: { projetos: true } } },
        ...(pag.enabled ? { take: pag.take, skip: pag.skip } : {}),
      }),
      prisma.nucleo.count({ where: { status: "approved" } }),
    ])

    const formatted = assignSlugsToList(nucleos).map((n) => ({
      ...n,
      totalProjetos: n._count.projetos,
    }))

    const envExibicao = parseInt(process.env.NUCLEOS_EXIBICAO_PUBLICA || "", 10)
    const rawPiso = process.env.NUCLEOS_EXIBICAO_PISO
    const piso = rawPiso === "0" ? 0
      : rawPiso ? (parseInt(rawPiso, 10) || DEFAULT_NUCLEOS_EXIBICAO_PISO)
      : DEFAULT_NUCLEOS_EXIBICAO_PISO

    let displayTotal = totalCadastrados
    if (envExibicao > 0) {
      displayTotal = envExibicao
    } else if (piso > 0) {
      displayTotal = Math.max(totalCadastrados, piso)
    }

    res.json({
      success: true,
      data: formatted,
      total: totalCadastrados,
      /** Número divulgado (rede); use NUCLEOS_EXIBICAO_PUBLICA quando for diferente dos aprovados no sistema */
      displayTotal,
    })
  } catch (error) {
    console.error("Error in GetNucleosAprovados:", error)
    res.status(500).json({ success: false, message: "Erro interno do servidor" })
  }
}

const putNucleoWithoutFile = async (req, res) => {
  const nucleoId = Number(req.params.id)

  if (!nucleoId) {
    return res.status(400).json({ success: false, message: "ID do núcleo é obrigatório" })
  }

  const { Nome, Email, Cidade, Descricao, DataFundacao, fotoCapa, foto1, foto2, foto3, linkDoacao, linkSite, linkLinkedin, linkFacebook, linkInstagram, logoUrl, corPrimaria, Endereco } = req.body

  try {
    await prisma.nucleo.update({
      where: { id: nucleoId },
      data: {
        ...(Nome && { Nome }),
        ...(Email && { Email }),
        ...(Cidade && { Cidade }),
        ...(Descricao && { Descricao }),
        ...(DataFundacao && { DataFundacao: new Date(DataFundacao) }),
        ...(fotoCapa && { fotoCapa }),
        ...(foto1 && { foto1 }),
        ...(foto2 && { foto2 }),
        ...(foto3 && { foto3 }),
        ...(linkDoacao !== undefined && { linkDoacao }),
        ...(linkSite !== undefined && { linkSite }),
        ...(linkLinkedin !== undefined && { linkLinkedin }),
        ...(linkFacebook !== undefined && { linkFacebook }),
        ...(linkInstagram !== undefined && { linkInstagram }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(corPrimaria !== undefined && { corPrimaria }),
        ...(Endereco !== undefined && { Endereco }),
      },
    })

    res.status(200).json({ success: true, message: "Núcleo atualizado com sucesso", data: { nucleoId } })
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ success: false, message: "Núcleo não encontrado" })
    console.error("Erro ao atualizar núcleo:", error)
    res.status(500).json({ success: false, message: "Erro ao atualizar núcleo" })
  }
}

module.exports = {
  CreateNucleo,
  CreateNucleoByAdmin,
  LoginNucleo,
  RefreshNucleoToken,
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
