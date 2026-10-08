const nodemailer = require("nodemailer")
const prisma = require("../lib/prismaClient")
const bcrypt = require("bcrypt")
const { normalizarPapel, PAPEIS_VALIDOS, SUPERADMIN } = require("../lib/adminRoles")
const { normalizeEmail } = require("../lib/email")
const { validarSenha } = require("../lib/password")
const { parseDataLocal } = require("../lib/dates")
const { gerarTokenSenha, linkDefinicaoSenha } = require("../lib/resetLink")
const { recuperacaoSenha } = require("../lib/emailLayout")
require("dotenv").config()

/**
 * Visao unificada de contas para o admin: administradores, nucleos e membros
 * vivem em tabelas diferentes, com nomes de coluna e vocabulario de status
 * diferentes. Este controller normaliza tudo para um formato so.
 */

const TIPOS = ["admin", "nucleo", "membro"]

/** Cada tipo tem seu proprio vocabulario de status; nao da para unificar sem mentir. */
const STATUS_VALIDOS = {
  admin: ["active", "inactive"],
  nucleo: ["pending", "approved", "reproved"],
  membro: ["ativo", "inativo", "desligado"],
}

/** Status em que a conta consegue efetivamente entrar no sistema. */
const STATUS_ATIVO = { admin: "active", nucleo: "approved", membro: "ativo" }

const RESET_TTL = "1h"

function buildTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_TRANSPORTER, pass: process.env.PASSWORD_TRANSPORTER },
  })
}

function normalizarAdmin(a) {
  return {
    tipo: "admin",
    id: a.id,
    nome: a.nome,
    email: a.email,
    status: a.status,
    ativo: a.status === STATUS_ATIVO.admin,
    papel: normalizarPapel(a.role),
    perfil: normalizarPapel(a.role),
    vinculo: null,
    ultimo_acesso: a.last_login,
    created_at: a.created_at,
    senha_definida: true,
  }
}

function normalizarNucleo(n) {
  return {
    tipo: "nucleo",
    id: n.id,
    nome: n.Nome,
    email: n.Email,
    status: n.status,
    ativo: n.status === STATUS_ATIVO.nucleo,
    papel: null,
    perfil: "nucleo",
    vinculo: [n.Cidade, n.Estado].filter(Boolean).join(" - ") || null,
    ultimo_acesso: null,
    created_at: n.created_at,
    senha_definida: true,
  }
}

function normalizarMembro(m) {
  return {
    tipo: "membro",
    id: m.id,
    nome: m.nome,
    email: m.email,
    status: m.status,
    ativo: m.status === STATUS_ATIVO.membro,
    papel: m.papel,
    perfil: m.papel,
    vinculo: m.nucleo?.Nome || null,
    ultimo_acesso: null,
    created_at: m.created_at,
    // Membro convidado que ainda nao definiu senha: nao consegue entrar.
    senha_definida: Boolean(m.senha),
  }
}

/**
 * GET /admin/usuarios?tipo=&busca=&somenteInativos=
 * Junta os tres tipos em memoria: sao poucas centenas de contas, e paginar no
 * banco exigiria tres consultas com offsets independentes que nao se combinam.
 */
const listar = async (req, res) => {
  const { tipo, busca } = req.query || {}

  if (tipo && !TIPOS.includes(tipo)) {
    return res.status(400).json({ success: false, message: `Tipo deve ser um de: ${TIPOS.join(", ")}` })
  }

  try {
    const querTipo = (t) => !tipo || tipo === t

    const [admins, nucleos, membros] = await Promise.all([
      querTipo("admin")
        ? prisma.admin.findMany({
            select: { id: true, nome: true, email: true, status: true, role: true, last_login: true, created_at: true },
          })
        : [],
      querTipo("nucleo")
        ? prisma.nucleo.findMany({
            // Sem `Senha` nem `Token`: o admin nao precisa deles e nao devem sair da API.
            select: { id: true, Nome: true, Email: true, status: true, Cidade: true, Estado: true, created_at: true },
          })
        : [],
      querTipo("membro")
        ? prisma.nucleoMembro.findMany({
            select: {
              id: true,
              nome: true,
              email: true,
              status: true,
              papel: true,
              senha: true,
              created_at: true,
              nucleo: { select: { Nome: true } },
            },
          })
        : [],
    ])

    let usuarios = [
      ...admins.map(normalizarAdmin),
      ...nucleos.map(normalizarNucleo),
      ...membros.map(normalizarMembro),
    ]

    const termo = String(busca || "").trim().toLowerCase()
    if (termo) {
      usuarios = usuarios.filter((u) =>
        [u.nome, u.email, u.vinculo].some((c) => String(c || "").toLowerCase().includes(termo)),
      )
    }

    usuarios.sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"))

    return res.json({
      success: true,
      data: usuarios,
      total: usuarios.length,
      resumo: {
        admins: usuarios.filter((u) => u.tipo === "admin").length,
        nucleos: usuarios.filter((u) => u.tipo === "nucleo").length,
        membros: usuarios.filter((u) => u.tipo === "membro").length,
        inativos: usuarios.filter((u) => !u.ativo).length,
        sem_senha: usuarios.filter((u) => !u.senha_definida).length,
      },
    })
  } catch (error) {
    console.error("Erro ao listar usuários:", error)
    return res.status(500).json({ success: false, message: "Erro ao listar usuários" })
  }
}

/** Busca a conta pelo par (tipo, id) e devolve o registro cru + o normalizado. */
async function carregarConta(tipo, id) {
  if (tipo === "admin") {
    const r = await prisma.admin.findUnique({ where: { id } })
    return r ? { registro: r, normalizado: normalizarAdmin(r) } : null
  }
  if (tipo === "nucleo") {
    const r = await prisma.nucleo.findUnique({ where: { id } })
    return r ? { registro: r, normalizado: normalizarNucleo(r) } : null
  }
  const r = await prisma.nucleoMembro.findUnique({ where: { id }, include: { nucleo: { select: { Nome: true } } } })
  return r ? { registro: r, normalizado: normalizarMembro(r) } : null
}

function lerParametros(req) {
  const tipo = String(req.params.tipo || "")
  const id = Number(req.params.id)
  if (!TIPOS.includes(tipo)) return { erro: `Tipo deve ser um de: ${TIPOS.join(", ")}` }
  if (!Number.isFinite(id)) return { erro: "ID inválido" }
  return { tipo, id }
}

/** GET /admin/usuarios/:tipo/:id — perfil completo da conta. */
const detalhe = async (req, res) => {
  const { tipo, id, erro } = lerParametros(req)
  if (erro) return res.status(400).json({ success: false, message: erro })

  try {
    const conta = await carregarConta(tipo, id)
    if (!conta) return res.status(404).json({ success: false, message: "Usuário não encontrado" })

    const extra = {}

    if (tipo === "nucleo") {
      const [projetos, membros] = await Promise.all([
        prisma.projeto.count({ where: { NucleoResponsavel: id } }),
        prisma.nucleoMembro.count({ where: { nucleoId: id } }),
      ])
      extra.projetos = projetos
      extra.membros = membros
    }

    if (tipo === "membro") {
      const r = conta.registro
      Object.assign(extra, {
        curso: r.curso,
        telefone: r.telefone,
        data_entrada: r.data_entrada,
        data_saida: r.data_saida,
        exibir_no_site: r.exibir_no_site,
        consentimento_em: r.consentimento_em,
        nucleoId: r.nucleoId,
      })
    }

    if (tipo === "nucleo") {
      const r = conta.registro
      Object.assign(extra, {
        cidade: r.Cidade,
        estado: r.Estado,
        subdominio: r.subdominio,
        data_fundacao: r.DataFundacao,
        aprovado_em: r.approved_at,
        motivo_reprovacao: r.rejection_reason,
        descricao: r.Descricao,
        linkDoacao: r.linkDoacao,
        linkSite: r.linkSite,
        linkLinkedin: r.linkLinkedin,
        linkFacebook: r.linkFacebook,
        linkInstagram: r.linkInstagram,
      })
    }

    return res.json({ success: true, data: { ...conta.normalizado, ...extra } })
  } catch (error) {
    console.error("Erro ao carregar usuário:", error)
    return res.status(500).json({ success: false, message: "Erro ao carregar usuário" })
  }
}

/**
 * POST /admin/usuarios/:tipo/:id/reset-senha
 * Envia o link de definicao de senha para o e-mail da conta. Diferente do fluxo
 * publico, aqui a resposta pode ser especifica: quem pede ja e admin autenticado.
 */
const enviarResetSenha = async (req, res) => {
  const { tipo, id, erro } = lerParametros(req)
  if (erro) return res.status(400).json({ success: false, message: erro })

  try {
    const conta = await carregarConta(tipo, id)
    if (!conta) return res.status(404).json({ success: false, message: "Usuário não encontrado" })

    const { registro, normalizado } = conta
    const hash = tipo === "nucleo" ? registro.Senha : registro.senha
    const token = gerarTokenSenha({ type: tipo, id, hash, ttl: RESET_TTL })
    const link = linkDefinicaoSenha(token)

    if (!process.env.EMAIL_TRANSPORTER || !process.env.PASSWORD_TRANSPORTER) {
      console.warn("[adminUsuarios] SMTP não configurado — link de senha:", link)
      return res.json({ success: true, message: "SMTP não configurado; link registrado no log do servidor." })
    }

    const conteudo = recuperacaoSenha({ nome: normalizado.nome, link })

    buildTransporter()
      .sendMail({
        from: process.env.EMAIL_TRANSPORTER,
        to: normalizado.email,
        subject: conteudo.subject,
        text: conteudo.text,
        html: conteudo.html,
      })
      .then(() => console.log(`[adminUsuarios] Link de senha enviado para ${normalizado.email}`))
      .catch((err) => console.error("[adminUsuarios] Falha ao enviar link de senha:", err.message))

    return res.json({ success: true, message: `Link enviado para ${normalizado.email}` })
  } catch (error) {
    console.error("Erro ao enviar link de senha:", error)
    return res.status(500).json({ success: false, message: "Erro ao enviar link de senha" })
  }
}

/** Encerra as sessoes da conta: usado ao desativar e ao excluir. */
function encerrarSessoes(tipo, id) {
  if (tipo === "admin") return prisma.adminToken.deleteMany({ where: { adminId: id } })
  if (tipo === "nucleo") return prisma.nucleoToken.deleteMany({ where: { nucleoId: id } })
  return prisma.membroToken.deleteMany({ where: { membroId: id } })
}

/** PATCH /admin/usuarios/:tipo/:id/status  { status } */
const alterarStatus = async (req, res) => {
  const { tipo, id, erro } = lerParametros(req)
  if (erro) return res.status(400).json({ success: false, message: erro })

  const { status } = req.body || {}
  if (!STATUS_VALIDOS[tipo].includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Para ${tipo}, status deve ser um de: ${STATUS_VALIDOS[tipo].join(", ")}`,
    })
  }

  // Um admin desativando a si mesmo perderia o acesso no ato.
  if (tipo === "admin" && req.admin?.id === id && status !== STATUS_ATIVO.admin) {
    return res.status(409).json({ success: false, message: "Você não pode desativar a própria conta" })
  }

  try {
    const conta = await carregarConta(tipo, id)
    if (!conta) return res.status(404).json({ success: false, message: "Usuário não encontrado" })

    // Sem isto, a organização pode ficar sem nenhum admin capaz de entrar.
    if (tipo === "admin" && status !== STATUS_ATIVO.admin) {
      const ativos = await prisma.admin.count({ where: { status: STATUS_ATIVO.admin } })
      if (ativos <= 1) {
        return res.status(409).json({ success: false, message: "Este é o último administrador ativo" })
      }
    }

    if (tipo === "admin") await prisma.admin.update({ where: { id }, data: { status } })
    else if (tipo === "nucleo") await prisma.nucleo.update({ where: { id }, data: { status } })
    else await prisma.nucleoMembro.update({ where: { id }, data: { status } })

    const virouInativo = status !== STATUS_ATIVO[tipo]
    if (virouInativo) await encerrarSessoes(tipo, id)

    await prisma.adminLog
      .create({
        data: {
          adminId: req.admin?.id || null,
          action: "usuario_status",
          details: { tipo, id, de: conta.normalizado.status, para: status },
          timestamp: new Date(),
        },
      })
      .catch((err) => console.error("Erro ao registrar log:", err.message))

    return res.json({
      success: true,
      message: virouInativo ? "Conta desativada e sessões encerradas" : "Conta ativada",
    })
  } catch (error) {
    console.error("Erro ao alterar status:", error)
    return res.status(500).json({ success: false, message: "Erro ao alterar status" })
  }
}

/**
 * DELETE /admin/usuarios/:tipo/:id?confirmar=true
 * Exclusao definitiva. Exige confirmacao explicita porque apagar um nucleo leva
 * junto, por cascata, os projetos e os membros dele.
 */
const excluir = async (req, res) => {
  const { tipo, id, erro } = lerParametros(req)
  if (erro) return res.status(400).json({ success: false, message: erro })

  if (tipo === "admin" && req.admin?.id === id) {
    return res.status(409).json({ success: false, message: "Você não pode excluir a própria conta" })
  }

  try {
    const conta = await carregarConta(tipo, id)
    if (!conta) return res.status(404).json({ success: false, message: "Usuário não encontrado" })

    // Preview do estrago antes de confirmar.
    let emCascata = null
    if (tipo === "nucleo") {
      const [projetos, membros] = await Promise.all([
        prisma.projeto.count({ where: { NucleoResponsavel: id } }),
        prisma.nucleoMembro.count({ where: { nucleoId: id } }),
      ])
      emCascata = { projetos, membros }
    }

    if (String(req.query.confirmar) !== "true") {
      return res.status(409).json({
        success: false,
        message: "Confirmação necessária",
        code: "CONFIRMACAO_NECESSARIA",
        alvo: conta.normalizado,
        emCascata,
      })
    }

    if (tipo === "admin") {
      const ativos = await prisma.admin.count({ where: { status: STATUS_ATIVO.admin } })
      if (ativos <= 1 && conta.normalizado.ativo) {
        return res.status(409).json({ success: false, message: "Este é o último administrador ativo" })
      }
      await prisma.admin.delete({ where: { id } })
    } else if (tipo === "nucleo") {
      await prisma.nucleo.delete({ where: { id } })
    } else {
      await prisma.nucleoMembro.delete({ where: { id } })
    }

    await prisma.adminLog
      .create({
        data: {
          adminId: req.admin?.id || null,
          action: "usuario_excluido",
          details: { tipo, id, nome: conta.normalizado.nome, email: conta.normalizado.email, emCascata },
          timestamp: new Date(),
        },
      })
      .catch((err) => console.error("Erro ao registrar log:", err.message))

    return res.json({ success: true, message: `${conta.normalizado.nome} foi excluído` })
  } catch (error) {
    console.error("Erro ao excluir usuário:", error)
    return res.status(500).json({ success: false, message: "Erro ao excluir usuário" })
  }
}

const PAPEIS_MEMBRO = ["membro", "coordenador"]

const textoOuNulo = (v, max) => {
  if (v === undefined) return undefined
  const t = String(v ?? "").trim()
  if (t.length > max) throw new Error(`Texto acima de ${max} caracteres`)
  return t === "" ? null : t
}

const dataOuNulo = (v) => {
  if (v === undefined) return undefined
  if (v === null || v === "") return null
  const d = parseDataLocal(v)
  if (!d) throw new Error("Data inválida")
  return d
}

/**
 * Monta o `data` do Prisma a partir do corpo, aceitando so os campos editaveis
 * de cada tipo. Lanca Error com mensagem amigavel quando algo e invalido.
 */
function montarAtualizacao(tipo, corpo) {
  const dados = {}
  const set = (chave, valor) => {
    if (valor !== undefined) dados[chave] = valor
  }
  const obrigatorio = (valor, rotulo) => {
    if (valor === undefined) return undefined
    if (!valor) throw new Error(`${rotulo} é obrigatório`)
    return valor
  }
  const emailValido = (v) => {
    if (v === undefined) return undefined
    const email = normalizeEmail(v)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "")) throw new Error("E-mail inválido")
    return email
  }

  if (tipo === "admin") {
    set("nome", obrigatorio(textoOuNulo(corpo.nome, 255), "Nome"))
    set("email", emailValido(corpo.email))
    if (corpo.role !== undefined) {
      if (!PAPEIS_VALIDOS.includes(corpo.role)) {
        throw new Error(`Perfil deve ser um de: ${PAPEIS_VALIDOS.join(", ")}`)
      }
      dados.role = corpo.role
    }
  } else if (tipo === "nucleo") {
    set("Nome", obrigatorio(textoOuNulo(corpo.nome, 255), "Nome"))
    set("Email", emailValido(corpo.email))
    set("Cidade", obrigatorio(textoOuNulo(corpo.cidade, 255), "Cidade"))
    set("Estado", textoOuNulo(corpo.estado, 100))
    set("Descricao", textoOuNulo(corpo.descricao, 5000))
    set("DataFundacao", dataOuNulo(corpo.dataFundacao))
    set("linkDoacao", textoOuNulo(corpo.linkDoacao, 255))
    set("linkSite", textoOuNulo(corpo.linkSite, 255))
    set("linkLinkedin", textoOuNulo(corpo.linkLinkedin, 255))
    set("linkFacebook", textoOuNulo(corpo.linkFacebook, 255))
    set("linkInstagram", textoOuNulo(corpo.linkInstagram, 255))
  } else {
    set("nome", obrigatorio(textoOuNulo(corpo.nome, 255), "Nome"))
    set("email", emailValido(corpo.email))
    if (corpo.papel !== undefined) {
      if (!PAPEIS_MEMBRO.includes(corpo.papel)) {
        throw new Error(`Perfil deve ser um de: ${PAPEIS_MEMBRO.join(", ")}`)
      }
      dados.papel = corpo.papel
    }
    set("curso", textoOuNulo(corpo.curso, 255))
    set("telefone", textoOuNulo(corpo.telefone, 20))
    set("data_entrada", dataOuNulo(corpo.dataEntrada))
    set("data_saida", dataOuNulo(corpo.dataSaida))
    if (corpo.exibirNoSite !== undefined) dados.exibir_no_site = Boolean(corpo.exibirNoSite)
    if (corpo.nucleoId !== undefined) {
      const nucleoId = Number(corpo.nucleoId)
      if (!Number.isInteger(nucleoId) || nucleoId < 1) throw new Error("Núcleo inválido")
      dados.nucleoId = nucleoId
    }
  }
  return dados
}

/** Procura outra conta (de qualquer tipo) que ja use o e-mail. */
async function emailEmUso(email, tipo, id) {
  const igual = { equals: email, mode: "insensitive" }
  const [admin, nucleo, membro] = await Promise.all([
    prisma.admin.findFirst({ where: { email: igual, NOT: tipo === "admin" ? { id } : undefined } }),
    prisma.nucleo.findFirst({ where: { Email: igual, NOT: tipo === "nucleo" ? { id } : undefined } }),
    prisma.nucleoMembro.findFirst({ where: { email: igual, NOT: tipo === "membro" ? { id } : undefined } }),
  ])
  return Boolean(admin || nucleo || membro)
}

/**
 * PUT /admin/usuarios/:tipo/:id
 * Edicao completa da conta: dados cadastrais, perfil (papel) e, opcionalmente,
 * uma nova senha. Mudar e-mail, perfil, nucleo ou senha encerra as sessoes da conta.
 */
const atualizar = async (req, res) => {
  const { tipo, id, erro } = lerParametros(req)
  if (erro) return res.status(400).json({ success: false, message: erro })

  const corpo = req.body || {}

  try {
    const conta = await carregarConta(tipo, id)
    if (!conta) return res.status(404).json({ success: false, message: "Usuário não encontrado" })

    let dados
    try {
      dados = montarAtualizacao(tipo, corpo)
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message })
    }

    const campoEmail = tipo === "nucleo" ? "Email" : "email"
    const campoSenha = tipo === "nucleo" ? "Senha" : "senha"

    if (dados[campoEmail] && (await emailEmUso(dados[campoEmail], tipo, id))) {
      return res.status(409).json({ success: false, message: "Já existe uma conta com este e-mail" })
    }

    if (corpo.senha) {
      const problemas = validarSenha(corpo.senha)
      if (problemas.length) return res.status(400).json({ success: false, message: problemas[0] })
      dados[campoSenha] = await bcrypt.hash(corpo.senha, 12)
    }

    if (tipo === "admin" && dados.role && dados.role !== SUPERADMIN && normalizarPapel(conta.registro.role) === SUPERADMIN) {
      if (req.admin?.id === id) {
        return res.status(409).json({ success: false, message: "Você não pode rebaixar o próprio perfil" })
      }
      const ativos = await prisma.admin.findMany({ where: { status: STATUS_ATIVO.admin }, select: { role: true } })
      if (ativos.filter((a) => normalizarPapel(a.role) === SUPERADMIN).length <= 1) {
        return res.status(409).json({ success: false, message: "Este é o último superadmin ativo" })
      }
    }

    if (Object.keys(dados).length === 0) {
      return res.status(400).json({ success: false, message: "Nenhuma alteração informada" })
    }

    try {
      if (tipo === "admin") await prisma.admin.update({ where: { id }, data: dados })
      else if (tipo === "nucleo") await prisma.nucleo.update({ where: { id }, data: dados })
      else await prisma.nucleoMembro.update({ where: { id }, data: dados })
    } catch (e) {
      if (e.code === "P2002") {
        return res.status(409).json({ success: false, message: "Já existe uma conta com este e-mail" })
      }
      if (e.code === "P2003") return res.status(400).json({ success: false, message: "Núcleo não encontrado" })
      throw e
    }

    const mudouAcesso = Boolean(dados[campoEmail] || dados[campoSenha] || dados.role || dados.papel || dados.nucleoId)
    if (mudouAcesso) await encerrarSessoes(tipo, id)

    await prisma.adminLog
      .create({
        data: {
          adminId: req.admin?.id || null,
          action: "usuario_editado",
          details: {
            tipo,
            id,
            campos: Object.keys(dados).filter((c) => c !== campoSenha),
            senhaAlterada: Boolean(dados[campoSenha]),
          },
          timestamp: new Date(),
        },
      })
      .catch((err) => console.error("Erro ao registrar log:", err.message))

    return res.json({
      success: true,
      message: mudouAcesso ? "Usuário atualizado. As sessões dele foram encerradas." : "Usuário atualizado",
    })
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error)
    return res.status(500).json({ success: false, message: "Erro ao atualizar usuário" })
  }
}

module.exports = { listar, detalhe, enviarResetSenha, alterarStatus, atualizar, excluir }
