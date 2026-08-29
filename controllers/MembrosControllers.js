const bcrypt = require("bcrypt")
const nodemailer = require("nodemailer")
const prisma = require("../lib/prismaClient")
const { generateTokens, refreshAccessToken } = require("../middlewares/authFunctions")
const { normalizeEmail, emailWhereInsensitive } = require("../lib/email")
const { gerarTokenSenha, linkDefinicaoSenha } = require("../lib/resetLink")
const { conviteMembro } = require("../lib/emailLayout")
const { validarSenha, REGRA_SENHA } = require("../lib/password")
require("dotenv").config()

/** Nunca devolver `senha`: o select e explicito para o campo nao vazar por engano. */
const MEMBRO_SELECT = {
  id: true,
  nucleoId: true,
  nome: true,
  email: true,
  papel: true,
  curso: true,
  telefone: true,
  foto_url: true,
  data_entrada: true,
  data_saida: true,
  status: true,
  exibir_no_site: true,
  consentimento_em: true,
  created_at: true,
}

const PAPEIS = ["membro", "coordenador"]
const STATUS = ["ativo", "inativo", "desligado"]

/** O convite vale mais que o reset comum: a pessoa pode demorar para abrir. */
const TTL_CONVITE = "7d"

function buildTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_TRANSPORTER, pass: process.env.PASSWORD_TRANSPORTER },
  })
}

/** `senha: null` marca convite pendente — usado pelo front para mostrar o estado. */
function comPendencia(membro, senhaDefinida) {
  return { ...membro, convite_pendente: !senhaDefinida }
}

function dataOuNull(valor) {
  if (!valor) return null
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Envia (ou reenvia) o convite. Fora do caminho da resposta: o membro ja esta
 * gravado, entao falha de SMTP nao pode derrubar o cadastro.
 */
function enviarConvite(membro, nomeNucleo) {
  const token = gerarTokenSenha({ type: "membro", id: membro.id, hash: null, ttl: TTL_CONVITE })
  const link = linkDefinicaoSenha(token)

  if (!process.env.EMAIL_TRANSPORTER || !process.env.PASSWORD_TRANSPORTER) {
    console.warn("[membros] SMTP não configurado — link de convite:", link)
    return
  }

  const conteudo = conviteMembro({ nome: membro.nome, nucleo: nomeNucleo, link })

  buildTransporter()
    .sendMail({
      from: process.env.EMAIL_TRANSPORTER,
      to: membro.email,
      subject: conteudo.subject,
      text: conteudo.text,
      html: conteudo.html,
    })
    .then(() => console.log(`[membros] Convite enviado para ${membro.email}`))
    .catch((error) => console.error("[membros] Falha ao enviar convite:", error.message))
}

/** GET /membros/nucleo/:id — lista os membros de um nucleo (nucleo dono ou admin). */
const listarDoNucleo = async (req, res) => {
  const nucleoId = Number(req.params.id)
  if (!Number.isFinite(nucleoId)) {
    return res.status(400).json({ success: false, message: "ID de núcleo inválido" })
  }

  try {
    const membros = await prisma.nucleoMembro.findMany({
      where: { nucleoId },
      orderBy: [{ status: "asc" }, { nome: "asc" }],
      select: { ...MEMBRO_SELECT, senha: true },
    })

    const data = membros.map(({ senha, ...m }) => comPendencia(m, Boolean(senha)))

    return res.json({ success: true, data, total: data.length })
  } catch (error) {
    console.error("Erro ao listar membros:", error)
    return res.status(500).json({ success: false, message: "Erro ao listar membros" })
  }
}

/** POST /membros/nucleo/:id — cadastra um membro e dispara o convite. */
const criar = async (req, res) => {
  const nucleoId = Number(req.params.id)
  const { nome, email, papel, curso, telefone, foto_url, data_entrada, exibir_no_site } = req.body || {}

  if (!Number.isFinite(nucleoId)) {
    return res.status(400).json({ success: false, message: "ID de núcleo inválido" })
  }
  if (!nome || !email) {
    return res.status(400).json({ success: false, message: "Nome e e-mail são obrigatórios" })
  }
  if (papel && !PAPEIS.includes(papel)) {
    return res.status(400).json({ success: false, message: `Papel deve ser um de: ${PAPEIS.join(", ")}` })
  }

  const emailNormalizado = normalizeEmail(email)

  try {
    const nucleo = await prisma.nucleo.findUnique({ where: { id: nucleoId }, select: { Nome: true } })
    if (!nucleo) return res.status(404).json({ success: false, message: "Núcleo não encontrado" })

    const jaExiste = await prisma.nucleoMembro.findFirst({
      where: { email: emailWhereInsensitive(email) },
      select: { id: true, nucleoId: true },
    })
    if (jaExiste) {
      return res.status(409).json({
        success: false,
        message:
          jaExiste.nucleoId === nucleoId
            ? "Este e-mail já está cadastrado neste núcleo"
            : "Este e-mail já está cadastrado em outro núcleo",
      })
    }

    const membro = await prisma.nucleoMembro.create({
      data: {
        nucleoId,
        nome: String(nome).trim(),
        email: emailNormalizado,
        papel: papel || "membro",
        curso: curso ? String(curso).trim() : null,
        telefone: telefone ? String(telefone).trim() : null,
        foto_url: foto_url || null,
        data_entrada: dataOuNull(data_entrada),
        // LGPD: so publica com consentimento; o padrao e nao aparecer no site.
        exibir_no_site: exibir_no_site === true,
        consentimento_em: exibir_no_site === true ? new Date() : null,
      },
      select: MEMBRO_SELECT,
    })

    enviarConvite(membro, nucleo.Nome)

    return res.status(201).json({
      success: true,
      message: "Membro cadastrado. Enviamos um convite para ele definir a senha.",
      data: comPendencia(membro, false),
    })
  } catch (error) {
    console.error("Erro ao cadastrar membro:", error)
    return res.status(500).json({ success: false, message: "Erro ao cadastrar membro" })
  }
}

/** PATCH /membros/:id — o nucleo edita os dados cadastrais do membro. */
const atualizar = async (req, res) => {
  const id = Number(req.params.id)
  const { nome, papel, curso, telefone, foto_url, data_entrada, data_saida, status, exibir_no_site } = req.body || {}

  if (papel && !PAPEIS.includes(papel)) {
    return res.status(400).json({ success: false, message: `Papel deve ser um de: ${PAPEIS.join(", ")}` })
  }
  if (status && !STATUS.includes(status)) {
    return res.status(400).json({ success: false, message: `Status deve ser um de: ${STATUS.join(", ")}` })
  }

  try {
    const atual = await prisma.nucleoMembro.findUnique({
      where: { id },
      select: { exibir_no_site: true, consentimento_em: true },
    })
    if (!atual) return res.status(404).json({ success: false, message: "Membro não encontrado" })

    const data = {}
    if (nome !== undefined) data.nome = String(nome).trim()
    if (papel !== undefined) data.papel = papel
    if (curso !== undefined) data.curso = curso ? String(curso).trim() : null
    if (telefone !== undefined) data.telefone = telefone ? String(telefone).trim() : null
    if (foto_url !== undefined) data.foto_url = foto_url || null
    if (data_entrada !== undefined) data.data_entrada = dataOuNull(data_entrada)
    if (data_saida !== undefined) data.data_saida = dataOuNull(data_saida)
    if (status !== undefined) data.status = status
    if (exibir_no_site !== undefined) {
      data.exibir_no_site = exibir_no_site === true
      // Registra QUANDO o consentimento foi dado; ao revogar, limpa a marca.
      if (exibir_no_site === true && !atual.exibir_no_site) data.consentimento_em = new Date()
      if (exibir_no_site !== true) data.consentimento_em = null
    }

    const membro = await prisma.nucleoMembro.update({ where: { id }, data, select: MEMBRO_SELECT })

    return res.json({ success: true, message: "Membro atualizado", data: membro })
  } catch (error) {
    console.error("Erro ao atualizar membro:", error)
    return res.status(500).json({ success: false, message: "Erro ao atualizar membro" })
  }
}

/**
 * DELETE /membros/:id — desliga o membro (soft): preserva o historico de
 * participacao, que a exclusao fisica apagaria junto com o vinculo em projetos.
 */
const desligar = async (req, res) => {
  const id = Number(req.params.id)

  try {
    const membro = await prisma.nucleoMembro.update({
      where: { id },
      data: {
        status: "desligado",
        data_saida: new Date(),
        exibir_no_site: false,
        consentimento_em: null,
      },
      select: MEMBRO_SELECT,
    })

    // Encerra a sessao: sem isso o desligado continuaria logado ate o token expirar.
    await prisma.membroToken.deleteMany({ where: { membroId: id } })

    return res.json({ success: true, message: "Membro desligado", data: membro })
  } catch (error) {
    console.error("Erro ao desligar membro:", error)
    return res.status(500).json({ success: false, message: "Erro ao desligar membro" })
  }
}

/** POST /membros/:id/convite — reenvia o convite de definicao de senha. */
const reenviarConvite = async (req, res) => {
  const id = Number(req.params.id)

  try {
    const membro = await prisma.nucleoMembro.findUnique({
      where: { id },
      select: { id: true, nome: true, email: true, senha: true, status: true, nucleo: { select: { Nome: true } } },
    })

    if (!membro) return res.status(404).json({ success: false, message: "Membro não encontrado" })
    if (membro.senha) {
      return res.status(409).json({ success: false, message: "Este membro já definiu a senha" })
    }
    if (membro.status === "desligado") {
      return res.status(409).json({ success: false, message: "Membro desligado não pode receber convite" })
    }

    enviarConvite(membro, membro.nucleo?.Nome)

    return res.json({ success: true, message: "Convite reenviado" })
  } catch (error) {
    console.error("Erro ao reenviar convite:", error)
    return res.status(500).json({ success: false, message: "Erro ao reenviar convite" })
  }
}

/** POST /membros/login */
const login = async (req, res) => {
  const { email, senha } = req.body || {}

  if (!email || !senha) {
    return res.status(400).json({ success: false, message: "Informe e-mail e senha" })
  }

  try {
    const membro = await prisma.nucleoMembro.findFirst({
      where: { email: emailWhereInsensitive(email) },
      include: { nucleo: { select: { id: true, Nome: true, subdominio: true, status: true } } },
    })

    if (!membro) return res.status(404).json({ success: false, message: "Usuário não encontrado" })

    if (!membro.senha) {
      return res.status(409).json({
        success: false,
        message: "Você ainda não definiu sua senha. Use o link do convite enviado por e-mail.",
        code: "CONVITE_PENDENTE",
      })
    }

    const senhaCorrespondente = await bcrypt.compare(senha, membro.senha)
    if (!senhaCorrespondente) {
      return res.status(401).json({ success: false, message: "Senha incorreta" })
    }

    if (membro.status !== "ativo") {
      return res.status(403).json({ success: false, message: "Seu cadastro não está ativo neste núcleo" })
    }
    if (membro.nucleo?.status !== "approved") {
      return res.status(403).json({ success: false, message: "O núcleo deste cadastro não está aprovado" })
    }

    const tokens = generateTokens(membro.id, "membro")

    await prisma.$transaction([
      prisma.membroToken.deleteMany({ where: { membroId: membro.id } }),
      prisma.membroToken.create({
        data: {
          membroId: membro.id,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          accessTokenExpires: tokens.accessTokenExpires,
          refreshTokenExpires: tokens.refreshTokenExpires,
        },
      }),
    ])

    return res.status(200).json({
      success: true,
      message: "Login realizado com sucesso.",
      id: membro.id,
      nome: membro.nome,
      papel: membro.papel,
      nucleoId: membro.nucleoId,
      nucleoNome: membro.nucleo?.Nome,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpires: tokens.accessTokenExpires,
      refreshTokenExpires: tokens.refreshTokenExpires,
    })
  } catch (error) {
    console.error("Erro no login de membro:", error)
    return res.status(500).json({ success: false, message: "Erro ao tentar fazer o login" })
  }
}

/** POST /membros/auth/refresh */
const refreshMembroToken = async (req, res) => {
  try {
    const refreshToken = req.body?.refreshToken || req.headers["x-refresh-token"]

    if (!refreshToken) {
      return res.status(401).json({ success: false, message: "Refresh token não fornecido", code: "MISSING_REFRESH_TOKEN" })
    }

    const novos = await refreshAccessToken(refreshToken)

    if (!novos) {
      return res.status(401).json({ success: false, message: "Token inválido ou expirado", code: "INVALID_REFRESH_TOKEN" })
    }

    return res.json({ success: true, data: novos })
  } catch (error) {
    console.error("Erro ao renovar token de membro:", error)
    return res.status(500).json({ success: false, message: "Erro ao renovar token" })
  }
}

/** GET /membros/me — dados do proprio membro logado. */
const meuPerfil = async (req, res) => {
  try {
    const membro = await prisma.nucleoMembro.findUnique({
      where: { id: req.membro.id },
      select: { ...MEMBRO_SELECT, nucleo: { select: { id: true, Nome: true, subdominio: true } } },
    })

    if (!membro) return res.status(404).json({ success: false, message: "Membro não encontrado" })

    return res.json({ success: true, data: membro })
  } catch (error) {
    console.error("Erro ao carregar perfil do membro:", error)
    return res.status(500).json({ success: false, message: "Erro ao carregar perfil" })
  }
}

/**
 * PATCH /membros/me — o membro edita os PROPRIOS dados.
 * Campos de vinculo (papel, status, nucleoId, datas) ficam de fora de proposito:
 * quem define isso e o nucleo, senao o membro se promoveria sozinho.
 */
const atualizarMeuPerfil = async (req, res) => {
  const { nome, curso, telefone, foto_url, exibir_no_site, senhaAtual, novaSenha } = req.body || {}

  try {
    const atual = await prisma.nucleoMembro.findUnique({
      where: { id: req.membro.id },
      select: { senha: true, exibir_no_site: true },
    })
    if (!atual) return res.status(404).json({ success: false, message: "Membro não encontrado" })

    const data = {}
    if (nome !== undefined) data.nome = String(nome).trim()
    if (curso !== undefined) data.curso = curso ? String(curso).trim() : null
    if (telefone !== undefined) data.telefone = telefone ? String(telefone).trim() : null
    if (foto_url !== undefined) data.foto_url = foto_url || null
    if (exibir_no_site !== undefined) {
      data.exibir_no_site = exibir_no_site === true
      if (exibir_no_site === true && !atual.exibir_no_site) data.consentimento_em = new Date()
      if (exibir_no_site !== true) data.consentimento_em = null
    }

    if (novaSenha) {
      // `validarSenha` devolve LISTA de problemas (vazia quando ok) — testar a
      // lista em si aceitaria qualquer senha, porque [] é truthy.
      const errosSenha = validarSenha(novaSenha)
      if (errosSenha.length > 0) {
        return res.status(400).json({ success: false, message: REGRA_SENHA, errors: errosSenha })
      }

      // Exige a senha atual: sem isso, um token roubado trocaria a senha da conta.
      const confere = atual.senha ? await bcrypt.compare(String(senhaAtual || ""), atual.senha) : false
      if (!confere) return res.status(401).json({ success: false, message: "Senha atual incorreta" })

      data.senha = await bcrypt.hash(novaSenha, 10)
    }

    const membro = await prisma.nucleoMembro.update({
      where: { id: req.membro.id },
      data,
      select: MEMBRO_SELECT,
    })

    // Trocar a senha invalida as sessoes antigas.
    if (data.senha) await prisma.membroToken.deleteMany({ where: { membroId: req.membro.id } })

    return res.json({
      success: true,
      message: data.senha ? "Perfil atualizado. Faça login novamente com a nova senha." : "Perfil atualizado",
      data: membro,
      senhaAlterada: Boolean(data.senha),
    })
  } catch (error) {
    console.error("Erro ao atualizar perfil do membro:", error)
    return res.status(500).json({ success: false, message: "Erro ao atualizar perfil" })
  }
}

module.exports = {
  listarDoNucleo,
  criar,
  atualizar,
  desligar,
  reenviarConvite,
  login,
  refreshMembroToken,
  meuPerfil,
  atualizarMeuPerfil,
}
