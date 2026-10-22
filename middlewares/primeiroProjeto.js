const jwt = require("jsonwebtoken")
const prisma = require("../lib/prismaClient")
const { normalizarPapel, SUPERADMIN } = require("../lib/adminRoles")
require("dotenv").config()

const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET

/**
 * Criação de projeto: exige autenticação, com UMA exceção controlada.
 *
 * O cadastro público de núcleo (formulário do site) cria o núcleo e, logo em
 * seguida, o "primeiro projeto" — nesse momento a pessoa ainda não tem login
 * (o núcleo nasce `pending` e o login só é liberado após aprovação). Por isso a
 * rota não podia simplesmente passar a exigir token: isso quebraria o cadastro.
 *
 * Regra: sem token, só é permitido criar projeto para um núcleo que esteja
 * `pending` E que ainda não tenha nenhum projeto. Assim o formulário continua
 * funcionando, mas ninguém consegue injetar projetos em núcleos já aprovados
 * nem inflar a base com vários projetos.
 */
async function permitirPrimeiroProjetoOuAutenticar(req, res, next) {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  // Com token: valida normalmente (admin ou núcleo dono).
  if (token) {
    return jwt.verify(token, accessTokenSecret, async (err, decoded) => {
      if (err) return res.status(403).json({ success: false, message: "Token inválido ou expirado" })

      try {
        if (decoded.type === "admin") {
          const rec = await prisma.adminToken.findFirst({
            where: { accessToken: token },
            select: { admin: { select: { status: true, role: true } } },
          })
          if (!rec) return res.status(403).json({ success: false, message: "Token não autorizado" })
          if (rec.admin?.status !== "active") {
            return res.status(403).json({ success: false, message: "Esta conta de administrador está desativada" })
          }
          const role = normalizarPapel(rec.admin.role)
          if (role !== SUPERADMIN) {
            return res.status(403).json({ success: false, message: "Seu usuário não tem permissão para esta área" })
          }
          req.admin = { id: decoded.userId, type: decoded.type, role }
          return next()
        }

        if (decoded.type === "membro") {
          const rec = await prisma.membroToken.findFirst({
            where: { accessToken: token },
            select: { membro: { select: { id: true, nome: true, papel: true, nucleoId: true, status: true } } },
          })
          if (!rec || rec.membro?.status !== "ativo") {
            return res.status(403).json({ success: false, message: "Token não autorizado" })
          }
          const { papel, nucleoId } = rec.membro
          if (!["diretor", "coordenador"].includes(papel)) {
            return res.status(403).json({
              success: false,
              message: "Seu perfil não pode criar projetos. Peça ao Diretor ou ao Coordenador.",
              code: "PAPEL_INSUFICIENTE",
            })
          }
          const alvoMembro = Number(req.body?.NucleoResponsavel)
          if (Number.isFinite(alvoMembro) && alvoMembro !== nucleoId) {
            return res.status(403).json({ success: false, message: "Você só pode criar projetos no seu próprio núcleo" })
          }
          // O formulario de projeto exige o nucleo; para membro ele e sempre o proprio.
          req.body = { ...(req.body || {}), NucleoResponsavel: nucleoId }
          req.membro = { id: decoded.userId, type: decoded.type, nome: rec.membro.nome, papel, nucleoId }
          return next()
        }

        const rec = await prisma.nucleoToken.findFirst({ where: { accessToken: token } })
        if (!rec) return res.status(403).json({ success: false, message: "Token não autorizado" })
        req.nucleo = { id: decoded.userId, type: decoded.type }

        const alvo = Number(req.body?.NucleoResponsavel)
        if (Number.isFinite(alvo) && alvo !== req.nucleo.id) {
          return res.status(403).json({ success: false, message: "Você só pode criar projetos no seu próprio núcleo" })
        }
        return next()
      } catch (error) {
        console.error("Erro ao validar token na criação de projeto:", error)
        return res.status(500).json({ success: false, message: "Erro ao validar o token" })
      }
    })
  }

  // Sem token: só o primeiro projeto de um núcleo recém-cadastrado.
  try {
    const nucleoId = Number(req.body?.NucleoResponsavel)
    if (!Number.isFinite(nucleoId)) {
      return res.status(401).json({ success: false, message: "Autenticação necessária para criar projetos" })
    }

    const nucleo = await prisma.nucleo.findUnique({
      where: { id: nucleoId },
      select: { id: true, status: true },
    })

    if (!nucleo || nucleo.status !== "pending") {
      return res.status(401).json({ success: false, message: "Autenticação necessária para criar projetos" })
    }

    const jaTemProjeto = await prisma.projeto.count({ where: { NucleoResponsavel: nucleoId } })
    if (jaTemProjeto > 0) {
      return res.status(401).json({ success: false, message: "Autenticação necessária para criar projetos" })
    }

    return next()
  } catch (error) {
    console.error("Erro ao validar criação do primeiro projeto:", error)
    return res.status(500).json({ success: false, message: "Erro ao validar a criação do projeto" })
  }
}

module.exports = { permitirPrimeiroProjetoOuAutenticar }
