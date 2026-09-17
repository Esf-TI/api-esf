const nodemailer = require("nodemailer")
const prisma = require("../lib/prismaClient")
const { normalizarPapel } = require("../lib/adminRoles")
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

module.exports = { listar, detalhe, enviarResetSenha, alterarStatus, excluir }
