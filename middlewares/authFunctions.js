const jwt = require("jsonwebtoken")
require("dotenv").config()
const moment = require("moment")
const prisma = require("../lib/prismaClient")
const { normalizarPapel, papelAtende, SUPERADMIN } = require("../lib/adminRoles")

const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET
const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET

function generateTokens(userId, type) {
  const payload = { userId, type }
  const accessTokenExpiresIn = "1d"
  const refreshTokenExpiresIn = "7d"

  const accessToken = jwt.sign(payload, accessTokenSecret, { expiresIn: accessTokenExpiresIn })
  const refreshToken = jwt.sign(payload, refreshTokenSecret, { expiresIn: refreshTokenExpiresIn })

  const accessTokenExpires = moment().add(1, "days").toDate()
  const refreshTokenExpires = moment().add(7, "days").toDate()

  return { accessToken, refreshToken, accessTokenExpires, refreshTokenExpires }
}

async function refreshAccessToken(refreshToken) {
  try {
    const decoded = jwt.verify(refreshToken, refreshTokenSecret)
    const { userId, type } = decoded

    const accessToken = jwt.sign({ userId, type }, accessTokenSecret, { expiresIn: "1d" })
    const newRefreshToken = jwt.sign({ userId, type }, refreshTokenSecret, { expiresIn: "7d" })

    const accessTokenExpires = new Date(Date.now() + 86400000)
    const refreshTokenExpires = new Date(Date.now() + 604800000)

    const dados = { accessToken, refreshToken: newRefreshToken, accessTokenExpires, refreshTokenExpires }

    // Despacho explicito por tipo: o `else` generico mandava qualquer tipo
    // desconhecido para nucleoToken, o que quebraria ao surgir um terceiro ator.
    if (type === "admin") {
      await prisma.adminToken.updateMany({ where: { adminId: userId }, data: dados })
    } else if (type === "membro") {
      await prisma.membroToken.updateMany({ where: { membroId: userId }, data: dados })
    } else {
      await prisma.nucleoToken.updateMany({ where: { nucleoId: userId }, data: dados })
    }

    return { accessToken, refreshToken: newRefreshToken, accessTokenExpires, refreshTokenExpires }
  } catch (error) {
    console.error("Error refreshing tokens:", error)
    return null
  }
}

function authenticateAdmin(req, res, next) {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ message: "Token não fornecido" })
  }

  jwt.verify(token, accessTokenSecret, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Token inválido ou expirado" })
    }

    try {
      // Traz o papel e o status junto com o token: `requireAdminRole` precisa do
      // papel e não deve custar uma segunda consulta, e uma conta desativada
      // seguia entrando enquanto o token dela não expirasse.
      const tokenRecord = await prisma.adminToken.findFirst({
        where: { accessToken: token },
        select: { admin: { select: { id: true, role: true, status: true } } },
      })
      if (!tokenRecord) {
        return res.status(403).json({ message: "Token não autorizado para esta ação" })
      }

      if (tokenRecord.admin?.status !== "active") {
        return res.status(403).json({ message: "Esta conta de administrador está desativada" })
      }

      req.admin = { id: decoded.userId, type: decoded.type, role: normalizarPapel(tokenRecord.admin.role) }
      req.user = decoded
      next()
    } catch (error) {
      return res.status(500).json({ message: "Erro ao validar o token" })
    }
  })
}

/**
 * Restringe a rota a determinados papéis de admin. Vai SEMPRE depois de
 * `authenticateAdmin` (ou de `authenticateAdminOrNucleo`), que é quem carrega
 * `req.admin.role`. Superadmin passa em tudo — ver `lib/adminRoles`.
 *
 * Uso: router.post("/", authenticateAdmin, requireAdminRole("conteudo"), ...)
 */
function requireAdminRole(...permitidos) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(403).json({ success: false, message: "Esta ação é restrita a administradores" })
    }

    if (!papelAtende(req.admin.role, permitidos)) {
      return res.status(403).json({
        success: false,
        message: "Seu usuário não tem permissão para esta área",
        code: "PAPEL_INSUFICIENTE",
      })
    }

    next()
  }
}

function authenticateNucleo(req, res, next) {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ message: "Token não fornecido" })
  }

  jwt.verify(token, accessTokenSecret, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Token inválido ou expirado" })
    }

    try {
      const tokenRecord = await prisma.nucleoToken.findFirst({ where: { accessToken: token } })
      if (!tokenRecord) {
        return res.status(403).json({ message: "Token não autorizado para esta ação" })
      }

      req.nucleo = { id: decoded.userId, type: decoded.type }
      req.user = decoded
      next()
    } catch (error) {
      return res.status(500).json({ message: "Erro ao validar o token" })
    }
  })
}

/**
 * Aceita admin OU núcleo. Popula `req.admin` ou `req.nucleo` conforme o tipo do
 * token, para o handler decidir o nível de acesso.
 */
function authenticateAdminOrNucleo(req, res, next) {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ message: "Token não fornecido" })
  }

  jwt.verify(token, accessTokenSecret, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Token inválido ou expirado" })
    }

    try {
      if (decoded.type === "admin") {
        const tokenRecord = await prisma.adminToken.findFirst({
          where: { accessToken: token },
          select: { admin: { select: { id: true, role: true, status: true } } },
        })
        if (!tokenRecord) return res.status(403).json({ message: "Token não autorizado para esta ação" })
        if (tokenRecord.admin?.status !== "active") {
          return res.status(403).json({ message: "Esta conta de administrador está desativada" })
        }
        req.admin = { id: decoded.userId, type: decoded.type, role: normalizarPapel(tokenRecord.admin.role) }
      } else if (decoded.type === "membro") {
        // Membro nao gerencia o nucleo: recusa com mensagem clara em vez de
        // cair na busca por nucleoToken e devolver um 403 generico.
        return res.status(403).json({ message: "Esta ação é restrita ao núcleo" })
      } else {
        const tokenRecord = await prisma.nucleoToken.findFirst({ where: { accessToken: token } })
        if (!tokenRecord) return res.status(403).json({ message: "Token não autorizado para esta ação" })
        req.nucleo = { id: decoded.userId, type: decoded.type }
      }

      req.user = decoded
      next()
    } catch (error) {
      return res.status(500).json({ message: "Erro ao validar o token" })
    }
  })
}


/** Papéis de membro que gerenciam os projetos do núcleo (além da conta do Núcleo). */
const PAPEIS_GESTORES = ["diretor", "coordenador"]

/** Id do núcleo a que o ator pertence: a conta do Núcleo ou o núcleo do membro. */
function nucleoDoAtor(req) {
  return req.nucleo?.id ?? req.membro?.nucleoId ?? null
}

/**
 * Aceita admin, núcleo OU membro. Popula `req.admin`, `req.nucleo` ou
 * `req.membro` (com papel e núcleo, lidos do banco a cada chamada: uma troca de
 * papel vale na hora). O handler decide o nível de acesso.
 */
function authenticateAtor(req, res, next) {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ message: "Token não fornecido" })
  }

  jwt.verify(token, accessTokenSecret, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Token inválido ou expirado" })
    }

    try {
      if (decoded.type === "admin") {
        const tokenRecord = await prisma.adminToken.findFirst({
          where: { accessToken: token },
          select: { admin: { select: { id: true, nome: true, role: true, status: true } } },
        })
        if (!tokenRecord) return res.status(403).json({ message: "Token não autorizado para esta ação" })
        if (tokenRecord.admin?.status !== "active") {
          return res.status(403).json({ message: "Esta conta de administrador está desativada" })
        }
        req.admin = {
          id: decoded.userId,
          type: decoded.type,
          nome: tokenRecord.admin.nome,
          role: normalizarPapel(tokenRecord.admin.role),
        }
      } else if (decoded.type === "membro") {
        const tokenRecord = await prisma.membroToken.findFirst({
          where: { accessToken: token },
          select: { membro: { select: { id: true, nome: true, papel: true, nucleoId: true, status: true } } },
        })
        if (!tokenRecord) return res.status(403).json({ message: "Token não autorizado para esta ação" })
        if (tokenRecord.membro?.status !== "ativo") {
          return res.status(403).json({ message: "Esta conta de membro está inativa" })
        }
        req.membro = {
          id: decoded.userId,
          type: decoded.type,
          nome: tokenRecord.membro.nome,
          papel: tokenRecord.membro.papel,
          nucleoId: tokenRecord.membro.nucleoId,
        }
      } else {
        const tokenRecord = await prisma.nucleoToken.findFirst({
          where: { accessToken: token },
          select: { nucleo: { select: { id: true, Nome: true } } },
        })
        if (!tokenRecord) return res.status(403).json({ message: "Token não autorizado para esta ação" })
        req.nucleo = { id: decoded.userId, type: decoded.type, nome: tokenRecord.nucleo?.Nome }
      }

      req.user = decoded
      next()
    } catch (error) {
      return res.status(500).json({ message: "Erro ao validar o token" })
    }
  })
}

/**
 * Só a conta do Núcleo, Diretor, Coordenador (do núcleo) ou superadmin mexem em
 * cards de projeto. Vai depois de `authenticateAtor`.
 */
function exigirPapelDeProjeto(req, res, next) {
  const ehGestor =
    (req.admin && req.admin.role === SUPERADMIN) ||
    Boolean(req.nucleo) ||
    (req.membro && PAPEIS_GESTORES.includes(req.membro.papel))

  if (!ehGestor) {
    return res.status(403).json({
      success: false,
      message: "Seu perfil não pode criar ou alterar projetos. Peça ao Diretor ou ao Coordenador.",
      code: "PAPEL_INSUFICIENTE",
    })
  }
  next()
}

/**
 * Impede que um núcleo altere os dados de OUTRO núcleo (IDOR): o alvo vem de
 * `req.params.id`, então sem esta checagem qualquer núcleo logado editava
 * qualquer outro. Admin passa direto (modera todos).
 */
function ensureNucleoSelf(req, res, next) {
  if (req.admin) return next()

  const targetId = Number(req.params.id)
  const meuNucleo = nucleoDoAtor(req)
  if (meuNucleo === null || !Number.isFinite(targetId) || meuNucleo !== targetId) {
    return res.status(403).json({ success: false, message: "Você só pode alterar os dados do seu próprio núcleo" })
  }

  next()
}

/**
 * Admin só opera projetos e tarefas de núcleos quando é superadmin: os papéis
 * `conteudo`, `materiais` e `coordenador_nacional` não têm essa permissão (o
 * Coordenador Nacional consulta pela visão nacional, somente leitura).
 */
function adminGerenciaNucleos(req, res, next) {
  if (req.admin.role === SUPERADMIN) return next()
  return res.status(403).json({
    success: false,
    message: "Seu usuário não tem permissão para esta área",
    code: "PAPEL_INSUFICIENTE",
  })
}

/**
 * Garante que o projeto alvo pertence ao núcleo autenticado. Superadmin passa direto.
 */
async function ensureProjetoDoNucleo(req, res, next) {
  if (req.admin) return adminGerenciaNucleos(req, res, next)

  const projetoId = Number(req.params.id)
  if (!Number.isFinite(projetoId)) {
    return res.status(400).json({ success: false, message: "ID de projeto inválido" })
  }

  try {
    const projeto = await prisma.projeto.findUnique({
      where: { id: projetoId },
      select: { NucleoResponsavel: true },
    })

    if (!projeto) return res.status(404).json({ success: false, message: "Projeto não encontrado" })

    const meuNucleo = nucleoDoAtor(req)
    if (meuNucleo === null || projeto.NucleoResponsavel !== meuNucleo) {
      return res.status(403).json({ success: false, message: "Este projeto pertence a outro núcleo" })
    }

    next()
  } catch (error) {
    console.error("Erro ao validar posse do projeto:", error)
    return res.status(500).json({ success: false, message: "Erro ao validar acesso ao projeto" })
  }
}

/**
 * Autentica um membro de nucleo (terceiro ator, ao lado de admin e nucleo).
 */
function authenticateMembro(req, res, next) {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ message: "Token não fornecido" })
  }

  jwt.verify(token, accessTokenSecret, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Token inválido ou expirado" })
    }

    if (decoded.type !== "membro") {
      return res.status(403).json({ message: "Token não é de um membro" })
    }

    try {
      const tokenRecord = await prisma.membroToken.findFirst({ where: { accessToken: token } })
      if (!tokenRecord) {
        return res.status(403).json({ message: "Token não autorizado para esta ação" })
      }

      req.membro = { id: decoded.userId, type: decoded.type }
      req.user = decoded
      next()
    } catch (error) {
      return res.status(500).json({ message: "Erro ao validar o token" })
    }
  })
}

/**
 * Garante que o membro alvo pertence ao nucleo autenticado — mesmo papel que
 * `ensureProjetoDoNucleo` faz para projetos. Admin passa direto.
 */
async function ensureMembroDoNucleo(req, res, next) {
  if (req.admin) return next()

  const membroId = Number(req.params.id)
  if (!Number.isFinite(membroId)) {
    return res.status(400).json({ success: false, message: "ID de membro inválido" })
  }

  try {
    const membro = await prisma.nucleoMembro.findUnique({
      where: { id: membroId },
      select: { nucleoId: true },
    })

    if (!membro) return res.status(404).json({ success: false, message: "Membro não encontrado" })

    if (!req.nucleo || membro.nucleoId !== req.nucleo.id) {
      return res.status(403).json({ success: false, message: "Este membro pertence a outro núcleo" })
    }

    next()
  } catch (error) {
    console.error("Erro ao validar posse do membro:", error)
    return res.status(500).json({ success: false, message: "Erro ao validar acesso ao membro" })
  }
}

/**
 * Garante que a tarefa alvo pertence a um projeto do nucleo autenticado.
 * Resolve tarefa -> projeto -> nucleo; sem isso, o :id da tarefa deixaria
 * qualquer nucleo mexer no quadro de outro. Admin passa direto.
 */
async function ensureTarefaDoNucleo(req, res, next) {
  if (req.admin) return adminGerenciaNucleos(req, res, next)

  const tarefaId = Number(req.params.id)
  if (!Number.isFinite(tarefaId)) {
    return res.status(400).json({ success: false, message: "ID de tarefa inválido" })
  }

  try {
    const tarefa = await prisma.projetoTarefa.findUnique({
      where: { id: tarefaId },
      select: { projeto: { select: { NucleoResponsavel: true } } },
    })

    if (!tarefa) return res.status(404).json({ success: false, message: "Tarefa não encontrada" })

    const meuNucleo = nucleoDoAtor(req)
    if (meuNucleo === null || tarefa.projeto?.NucleoResponsavel !== meuNucleo) {
      return res.status(403).json({ success: false, message: "Esta tarefa pertence a outro núcleo" })
    }

    next()
  } catch (error) {
    console.error("Erro ao validar posse da tarefa:", error)
    return res.status(500).json({ success: false, message: "Erro ao validar acesso à tarefa" })
  }
}

/**
 * Identifica o ator quando há token válido e deixa passar quando não há.
 *
 * Serve às listagens que mostram um recorte para visitante e o acervo inteiro
 * para quem está logado (materiais). Diferente dos demais, nunca responde 401:
 * token ausente, expirado ou revogado apenas resulta em requisição anônima.
 */
function authenticateOpcional(req, res, next) {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) return next()

  jwt.verify(token, accessTokenSecret, async (err, decoded) => {
    if (err) return next()

    try {
      if (decoded.type === "admin") {
        const tokenRecord = await prisma.adminToken.findFirst({
          where: { accessToken: token },
          select: { admin: { select: { id: true, role: true, status: true } } },
        })
        if (tokenRecord && tokenRecord.admin?.status === "active") {
          req.admin = { id: decoded.userId, type: decoded.type, role: normalizarPapel(tokenRecord.admin.role) }
          req.user = decoded
        }
      } else if (decoded.type === "membro") {
        const tokenRecord = await prisma.membroToken.findFirst({ where: { accessToken: token } })
        if (tokenRecord) {
          req.membro = { id: decoded.userId, type: decoded.type }
          req.user = decoded
        }
      } else {
        const tokenRecord = await prisma.nucleoToken.findFirst({ where: { accessToken: token } })
        if (tokenRecord) {
          req.nucleo = { id: decoded.userId, type: decoded.type }
          req.user = decoded
        }
      }
    } catch (error) {
      console.error("Erro ao identificar ator opcional:", error)
    }

    next()
  })
}

module.exports = {
  generateTokens,
  refreshAccessToken,
  authenticateAdmin,
  authenticateNucleo,
  authenticateAdminOrNucleo,
  authenticateAtor,
  exigirPapelDeProjeto,
  nucleoDoAtor,
  authenticateMembro,
  authenticateOpcional,
  requireAdminRole,
  ensureNucleoSelf,
  ensureProjetoDoNucleo,
  ensureMembroDoNucleo,
  ensureTarefaDoNucleo,
}
