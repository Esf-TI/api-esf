const prisma = require("../lib/prismaClient")
const { SUPERADMIN } = require("../lib/adminRoles")
const { registrar } = require("../lib/auditoria")

/** Reserva de edição: uma pessoa por vez. Cada salvamento ou renovação estende. */
const MINUTOS_BLOQUEIO = 2
/** Instantâneo guardado no máximo a cada 5 minutos de edição, e só os 20 mais recentes. */
const MINUTOS_ENTRE_VERSOES = 5
const MAX_VERSOES = 20
/** Teto da cena (JSON): imagens coladas entram em base64 dentro dela. */
const MAX_CENA_BYTES = 12 * 1024 * 1024

const CENA_VAZIA = { elements: [], appState: {}, files: {} }

const LISTA_SELECT = {
  id: true,
  titulo: true,
  escopo: true,
  nucleo_id: true,
  miniatura: true,
  autor_tipo: true,
  autor_id: true,
  autor_nome: true,
  versao: true,
  created_at: true,
  updated_at: true,
}

const nucleoDoAtor = (req) => req.nucleo?.id ?? req.membro?.nucleoId ?? null
const ehSuperadmin = (req) => Boolean(req.admin && req.admin.role === SUPERADMIN)
const ehModerador = (req) =>
  Boolean(req.admin && (req.admin.role === SUPERADMIN || req.admin.role === "coordenador_nacional"))
const ehGestorDeNucleo = (req) =>
  ehSuperadmin(req) || Boolean(req.nucleo) || (req.membro && ["diretor", "coordenador"].includes(req.membro.papel))

function autorDe(req) {
  if (req.membro) return { tipo: "membro", id: req.membro.id, nome: req.membro.nome || null }
  if (req.nucleo) return { tipo: "nucleo", id: req.nucleo.id, nome: req.nucleo.nome || null }
  return { tipo: "admin", id: req.admin.id, nome: req.admin.nome || null }
}

const chaveDoAtor = (req) => {
  const a = autorDe(req)
  return `${a.tipo}:${a.id}`
}

const ehAutor = (req, q) => {
  const a = autorDe(req)
  return q.autor_tipo === a.tipo && q.autor_id === a.id
}

/** Quadro nacional: todo perfil logado vê. Quadro de núcleo: só quem é do núcleo (e o superadmin). */
function podeVer(req, q) {
  if (q.escopo === "nacional") return true
  return ehSuperadmin(req) || (q.nucleo_id !== null && nucleoDoAtor(req) === q.nucleo_id)
}

/** Edita: o autor, os gestores do núcleo (nos de núcleo) ou a gestão nacional (nos nacionais). */
function podeEditar(req, q) {
  if (!podeVer(req, q)) return false
  if (ehAutor(req, q)) return true
  return q.escopo === "nacional" ? ehModerador(req) : ehGestorDeNucleo(req)
}

const bloqueioAtivo = (q) => Boolean(q.bloqueio_ate && q.bloqueio_ate > new Date())
const bloqueadoPorOutro = (req, q) => bloqueioAtivo(q) && q.bloqueio_ator !== chaveDoAtor(req)

function infoBloqueio(req, q) {
  if (!bloqueadoPorOutro(req, q)) return null
  return { nome: q.bloqueio_nome || "outra pessoa", ate: q.bloqueio_ate }
}

function tamanhoDaCena(cena) {
  try {
    return Buffer.byteLength(JSON.stringify(cena), "utf8")
  } catch {
    return Infinity
  }
}

const cenaValida = (cena) =>
  cena && typeof cena === "object" && !Array.isArray(cena) && Array.isArray(cena.elements)

async function carregar(req, res) {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) {
    res.status(400).json({ success: false, message: "ID inválido" })
    return null
  }
  const quadro = await prisma.quadro.findUnique({ where: { id } })
  if (!quadro || !podeVer(req, quadro)) {
    res.status(404).json({ success: false, message: "Quadro não encontrado" })
    return null
  }
  return quadro
}

/** Guarda um instantâneo se o último é antigo; mantém só os mais recentes. */
async function guardarVersao(quadro, nomeAutor) {
  const ultima = await prisma.quadroVersao.findFirst({
    where: { quadro_id: quadro.id },
    orderBy: { versao: "desc" },
    select: { created_at: true },
  })
  const recente = ultima && Date.now() - new Date(ultima.created_at).getTime() < MINUTOS_ENTRE_VERSOES * 60 * 1000
  if (recente) return

  await prisma.quadroVersao.upsert({
    where: { quadro_id_versao: { quadro_id: quadro.id, versao: quadro.versao } },
    create: { quadro_id: quadro.id, versao: quadro.versao, cena: quadro.cena, autor_nome: nomeAutor },
    update: {},
  })

  const antigas = await prisma.quadroVersao.findMany({
    where: { quadro_id: quadro.id },
    orderBy: { versao: "desc" },
    skip: MAX_VERSOES,
    select: { id: true },
  })
  if (antigas.length) await prisma.quadroVersao.deleteMany({ where: { id: { in: antigas.map((v) => v.id) } } })
}

const QuadrosController = {
  /** GET /quadros?escopo=nucleo|nacional&busca= */
  async listar(req, res) {
    try {
      const meuNucleo = nucleoDoAtor(req)
      const escopo = String(req.query.escopo || "")
      const busca = String(req.query.busca || "").trim()

      const visiveis = ehSuperadmin(req)
        ? {}
        : { OR: [{ escopo: "nacional" }, ...(meuNucleo !== null ? [{ escopo: "nucleo", nucleo_id: meuNucleo }] : [])] }

      const where = {
        AND: [
          visiveis,
          ...(escopo === "nucleo" || escopo === "nacional" ? [{ escopo }] : []),
          ...(busca ? [{ titulo: { contains: busca, mode: "insensitive" } }] : []),
        ],
      }

      const quadros = await prisma.quadro.findMany({ where, orderBy: { updated_at: "desc" }, take: 200, select: LISTA_SELECT })
      return res.json({
        success: true,
        data: quadros.map((q) => ({ ...q, pode_editar: podeEditar(req, q) })),
        total: quadros.length,
      })
    } catch (error) {
      console.error("Erro ao listar quadros:", error)
      return res.status(500).json({ success: false, message: "Erro ao listar os quadros" })
    }
  },

  /** POST /quadros { titulo, escopo } */
  async criar(req, res) {
    const titulo = String(req.body?.titulo || "").trim().slice(0, 255)
    const escopo = req.body?.escopo === "nacional" ? "nacional" : "nucleo"
    if (!titulo) return res.status(400).json({ success: false, message: "Dê um título ao quadro" })

    const nucleoId = escopo === "nucleo" ? nucleoDoAtor(req) : null
    if (escopo === "nucleo" && nucleoId === null) {
      return res.status(400).json({ success: false, message: "Só quem é de um núcleo cria quadros do núcleo" })
    }

    try {
      const autor = autorDe(req)
      const quadro = await prisma.quadro.create({
        data: {
          titulo,
          escopo,
          nucleo_id: nucleoId,
          cena: CENA_VAZIA,
          autor_tipo: autor.tipo,
          autor_id: autor.id,
          autor_nome: autor.nome,
        },
        select: LISTA_SELECT,
      })
      registrar(req, { acao: "quadro.criado", entidade: "quadro", entidadeId: quadro.id, nucleoId, depois: { titulo, escopo } })
      return res.status(201).json({ success: true, message: "Quadro criado", data: { ...quadro, pode_editar: true } })
    } catch (error) {
      console.error("Erro ao criar quadro:", error)
      return res.status(500).json({ success: false, message: "Erro ao criar o quadro" })
    }
  },

  /** GET /quadros/:id — devolve a cena e se o usuário pode editar agora. */
  async abrir(req, res) {
    try {
      const quadro = await carregar(req, res)
      if (!quadro) return
      const editar = podeEditar(req, quadro)
      const bloqueio = infoBloqueio(req, quadro)
      return res.json({
        success: true,
        data: { ...quadro, bloqueio_ator: undefined, pode_editar: editar, bloqueado_por: bloqueio },
      })
    } catch (error) {
      console.error("Erro ao abrir quadro:", error)
      return res.status(500).json({ success: false, message: "Erro ao abrir o quadro" })
    }
  },

  /** POST /quadros/:id/bloqueio — reserva (ou renova) a edição. 423 se outra pessoa está editando. */
  async bloquear(req, res) {
    try {
      const quadro = await carregar(req, res)
      if (!quadro) return
      if (!podeEditar(req, quadro)) {
        return res.status(403).json({ success: false, message: "Você só pode visualizar este quadro", code: "PAPEL_INSUFICIENTE" })
      }
      if (bloqueadoPorOutro(req, quadro)) {
        return res.status(423).json({
          success: false,
          message: `${quadro.bloqueio_nome || "Outra pessoa"} está editando este quadro agora`,
          bloqueado_por: infoBloqueio(req, quadro),
        })
      }
      const ate = new Date(Date.now() + MINUTOS_BLOQUEIO * 60 * 1000)
      await prisma.quadro.update({
        where: { id: quadro.id },
        data: { bloqueio_ator: chaveDoAtor(req), bloqueio_nome: autorDe(req).nome, bloqueio_ate: ate },
        select: { id: true },
      })
      return res.json({ success: true, data: { ate, versao: quadro.versao } })
    } catch (error) {
      console.error("Erro ao bloquear quadro:", error)
      return res.status(500).json({ success: false, message: "Erro ao reservar a edição" })
    }
  },

  /** DELETE /quadros/:id/bloqueio — libera a edição ao sair. */
  async liberar(req, res) {
    try {
      const quadro = await carregar(req, res)
      if (!quadro) return
      if (quadro.bloqueio_ator === chaveDoAtor(req)) {
        await prisma.quadro.update({
          where: { id: quadro.id },
          data: { bloqueio_ator: null, bloqueio_nome: null, bloqueio_ate: null },
          select: { id: true },
        })
      }
      return res.json({ success: true })
    } catch (error) {
      console.error("Erro ao liberar quadro:", error)
      return res.status(500).json({ success: false, message: "Erro ao liberar a edição" })
    }
  },

  /** PUT /quadros/:id { cena, versao, miniatura? } — salvamento automático. */
  async salvar(req, res) {
    try {
      const quadro = await carregar(req, res)
      if (!quadro) return
      if (!podeEditar(req, quadro)) {
        return res.status(403).json({ success: false, message: "Você só pode visualizar este quadro", code: "PAPEL_INSUFICIENTE" })
      }
      if (bloqueadoPorOutro(req, quadro)) {
        return res.status(423).json({
          success: false,
          message: `${quadro.bloqueio_nome || "Outra pessoa"} está editando este quadro agora`,
          bloqueado_por: infoBloqueio(req, quadro),
        })
      }

      const { cena, versao, miniatura } = req.body || {}
      if (!cenaValida(cena)) return res.status(400).json({ success: false, message: "Cena inválida" })
      if (tamanhoDaCena(cena) > MAX_CENA_BYTES) {
        return res.status(413).json({
          success: false,
          message: "O quadro ficou grande demais (limite de 12 MB). Remova ou reduza as imagens.",
        })
      }
      if (Number(versao) !== quadro.versao) {
        return res.status(409).json({
          success: false,
          message: "Este quadro foi alterado em outro lugar. Recarregue a página para ver a versão mais recente.",
          code: "VERSAO_DESATUALIZADA",
          versao: quadro.versao,
        })
      }

      await guardarVersao(quadro, quadro.autor_nome)

      const ate = new Date(Date.now() + MINUTOS_BLOQUEIO * 60 * 1000)
      const atualizado = await prisma.quadro.update({
        where: { id: quadro.id },
        data: {
          cena,
          versao: quadro.versao + 1,
          ...(typeof miniatura === "string" && miniatura.length < 200_000 ? { miniatura } : {}),
          bloqueio_ator: chaveDoAtor(req),
          bloqueio_nome: autorDe(req).nome,
          bloqueio_ate: ate,
        },
        select: { versao: true, updated_at: true },
      })
      return res.json({ success: true, data: { versao: atualizado.versao, atualizado_em: atualizado.updated_at, ate } })
    } catch (error) {
      console.error("Erro ao salvar quadro:", error)
      return res.status(500).json({ success: false, message: "Erro ao salvar o quadro" })
    }
  },

  /** PATCH /quadros/:id { titulo } */
  async renomear(req, res) {
    const titulo = String(req.body?.titulo || "").trim().slice(0, 255)
    if (!titulo) return res.status(400).json({ success: false, message: "O título não pode ficar vazio" })
    try {
      const quadro = await carregar(req, res)
      if (!quadro) return
      if (!podeEditar(req, quadro)) {
        return res.status(403).json({ success: false, message: "Você não pode renomear este quadro", code: "PAPEL_INSUFICIENTE" })
      }
      await prisma.quadro.update({ where: { id: quadro.id }, data: { titulo }, select: { id: true } })
      registrar(req, {
        acao: "quadro.renomeado",
        entidade: "quadro",
        entidadeId: quadro.id,
        nucleoId: quadro.nucleo_id,
        antes: { titulo: quadro.titulo },
        depois: { titulo },
      })
      return res.json({ success: true, message: "Quadro renomeado", data: { titulo } })
    } catch (error) {
      console.error("Erro ao renomear quadro:", error)
      return res.status(500).json({ success: false, message: "Erro ao renomear o quadro" })
    }
  },

  /** DELETE /quadros/:id */
  async excluir(req, res) {
    try {
      const quadro = await carregar(req, res)
      if (!quadro) return
      if (!podeEditar(req, quadro)) {
        return res.status(403).json({ success: false, message: "Você não pode excluir este quadro", code: "PAPEL_INSUFICIENTE" })
      }
      await prisma.quadro.delete({ where: { id: quadro.id } })
      registrar(req, {
        acao: "quadro.excluido",
        entidade: "quadro",
        entidadeId: quadro.id,
        nucleoId: quadro.nucleo_id,
        antes: { titulo: quadro.titulo, escopo: quadro.escopo, versao: quadro.versao },
      })
      return res.json({ success: true, message: "Quadro excluído" })
    } catch (error) {
      console.error("Erro ao excluir quadro:", error)
      return res.status(500).json({ success: false, message: "Erro ao excluir o quadro" })
    }
  },

  /** GET /quadros/:id/versoes */
  async versoes(req, res) {
    try {
      const quadro = await carregar(req, res)
      if (!quadro) return
      const versoes = await prisma.quadroVersao.findMany({
        where: { quadro_id: quadro.id },
        orderBy: { versao: "desc" },
        select: { versao: true, autor_nome: true, created_at: true },
      })
      return res.json({ success: true, data: versoes })
    } catch (error) {
      console.error("Erro ao listar versões do quadro:", error)
      return res.status(500).json({ success: false, message: "Erro ao listar as versões" })
    }
  },

  /** POST /quadros/:id/versoes/:versao/restaurar */
  async restaurar(req, res) {
    try {
      const quadro = await carregar(req, res)
      if (!quadro) return
      if (!podeEditar(req, quadro)) {
        return res.status(403).json({ success: false, message: "Você não pode restaurar este quadro", code: "PAPEL_INSUFICIENTE" })
      }
      if (bloqueadoPorOutro(req, quadro)) {
        return res.status(423).json({ success: false, message: `${quadro.bloqueio_nome || "Outra pessoa"} está editando este quadro agora` })
      }
      const numero = Number(req.params.versao)
      const alvo = await prisma.quadroVersao.findUnique({
        where: { quadro_id_versao: { quadro_id: quadro.id, versao: numero } },
      })
      if (!alvo) return res.status(404).json({ success: false, message: "Versão não encontrada" })

      // Guarda o estado atual antes de voltar no tempo, para não perder o que está lá agora.
      await prisma.quadroVersao.upsert({
        where: { quadro_id_versao: { quadro_id: quadro.id, versao: quadro.versao } },
        create: { quadro_id: quadro.id, versao: quadro.versao, cena: quadro.cena, autor_nome: autorDe(req).nome },
        update: {},
      })
      const atualizado = await prisma.quadro.update({
        where: { id: quadro.id },
        data: { cena: alvo.cena, versao: quadro.versao + 1 },
        select: { versao: true },
      })
      registrar(req, {
        acao: "quadro.restaurado",
        entidade: "quadro",
        entidadeId: quadro.id,
        nucleoId: quadro.nucleo_id,
        antes: { versao: quadro.versao },
        depois: { restauradaDaVersao: numero, novaVersao: atualizado.versao },
      })
      return res.json({ success: true, message: "Versão restaurada", data: { versao: atualizado.versao } })
    } catch (error) {
      console.error("Erro ao restaurar quadro:", error)
      return res.status(500).json({ success: false, message: "Erro ao restaurar a versão" })
    }
  },
}

module.exports = QuadrosController
