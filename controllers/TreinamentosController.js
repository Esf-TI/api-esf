const sanitizeHtml = require("sanitize-html")
const prisma = require("../lib/prismaClient")
const supabase = require("../lib/supabaseClient")
const { SUPERADMIN } = require("../lib/adminRoles")
const { uploadPublicBuffer } = require("../lib/storageService")
const { extrairVideoYoutube } = require("../lib/youtube")
const { registrar, diferenca } = require("../lib/auditoria")

const BUCKET = "treinamentos"
const MAX_ANEXOS_POR_AULA = 10
const VISIBILIDADES = ["todos", "nacional", "nucleos"]
const STATUS_PEDIDO = ["aberto", "em_analise", "atendido", "recusado"]

/** Tipos de anexo aceitos: documentos, planilhas, apresentações, imagens, texto e zip. */
const TIPOS_ANEXO = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
])

/** Texto da aula: o editor gera HTML, então só passam as marcas de formatação básicas. */
const OPCOES_HTML = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "h2", "h3", "h4", "blockquote", "a", "span", "pre", "code"],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedClasses: { p: ["ql-*"], li: ["ql-*"], h2: ["ql-*"], h3: ["ql-*"], h4: ["ql-*"], span: ["ql-*"], pre: ["ql-*"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: (tag, atributos) => ({ tagName: "a", attribs: { ...atributos, target: "_blank", rel: "noopener noreferrer" } }),
  },
}

const limparTexto = (html) => {
  if (html === undefined) return undefined
  const limpo = sanitizeHtml(String(html || ""), OPCOES_HTML).trim()
  return limpo === "" ? null : limpo
}

const ehGestor = (req) =>
  Boolean(req.admin && (req.admin.role === SUPERADMIN || req.admin.role === "coordenador_nacional"))

function autorDe(req) {
  if (req.membro) return { tipo: "membro", id: req.membro.id, nome: req.membro.nome || null }
  if (req.nucleo) return { tipo: "nucleo", id: req.nucleo.id, nome: req.nucleo.nome || null }
  return { tipo: "admin", id: req.admin.id, nome: req.admin.nome || null }
}

/** Rascunhos só a gestão vê; "nacional" só a equipe nacional; "nucleos" só quem é de núcleo. */
function podeVer(req, t) {
  if (ehGestor(req)) return true
  if (t.status !== "publicado") return false
  if (t.visibilidade === "nacional") return Boolean(req.admin)
  if (t.visibilidade === "nucleos") return Boolean(req.nucleo || req.membro)
  return true
}

const exigirGestor = (req, res) => {
  if (ehGestor(req)) return true
  res.status(403).json({
    success: false,
    message: "Só a gestão nacional gerencia os treinamentos",
    code: "PAPEL_INSUFICIENTE",
  })
  return false
}

const texto = (v, max) => {
  const t = String(v ?? "").trim()
  return t.length > max ? t.slice(0, max) : t
}

/** Corrige acentos de nomes de arquivo (o multer entrega latin1). */
function fixFileName(name) {
  if (!name) return name
  try {
    return Buffer.from(name, "latin1").toString("utf8")
  } catch {
    return name
  }
}

function caminhoNoStorage(url) {
  const m = String(url || "").match(new RegExp(`/storage/v1/object/public/${BUCKET}/(.+)`))
  return m ? m[1] : null
}

async function removerArquivos(urls) {
  const caminhos = urls.map(caminhoNoStorage).filter(Boolean)
  if (!caminhos.length) return
  try {
    await supabase.storage.from(BUCKET).remove(caminhos)
  } catch (e) {
    console.warn("Não foi possível remover anexos de treinamento:", e.message)
  }
}

const AULA_SELECT = {
  id: true,
  treinamento_id: true,
  titulo: true,
  texto: true,
  video_url: true,
  video_id: true,
  ordem: true,
  anexos: {
    orderBy: [{ ordem: "asc" }, { id: "asc" }],
    select: { id: true, nome: true, url: true, tamanho: true, tipo: true, ordem: true },
  },
}

async function carregarTreinamento(req, res, id) {
  const t = await prisma.treinamento.findUnique({ where: { id } })
  if (!t || !podeVer(req, t)) {
    res.status(404).json({ success: false, message: "Treinamento não encontrado" })
    return null
  }
  return t
}

const idDe = (req, nome = "id") => {
  const n = Number(req.params[nome])
  return Number.isFinite(n) ? n : null
}

const TreinamentosController = {
  // ------------------------------------------------------------------ leitura

  /** GET /treinamentos?todos=1 — catálogo com o progresso de quem pergunta. `todos=1` (gestão) inclui rascunhos. */
  async listar(req, res) {
    try {
      const incluirRascunhos = ehGestor(req) && String(req.query.todos) === "1"
      const treinamentos = await prisma.treinamento.findMany({
        where: incluirRascunhos ? {} : { status: "publicado" },
        orderBy: [{ categoria: "asc" }, { ordem: "asc" }, { id: "asc" }],
        include: { aulas: { orderBy: { ordem: "asc" }, select: { id: true, video_id: true } } },
      })
      const visiveis = treinamentos.filter((t) => podeVer(req, t))
      const aulaIds = visiveis.flatMap((t) => t.aulas.map((a) => a.id))

      const ator = autorDe(req)
      const concluidas = new Set(
        (
          await prisma.treinamentoProgresso.findMany({
            where: { aula_id: { in: aulaIds }, ator_tipo: ator.tipo, ator_id: ator.id },
            select: { aula_id: true },
          })
        ).map((p) => p.aula_id),
      )

      // Gestão: quantas pessoas terminaram cada treinamento.
      let concluiramPor = null
      if (incluirRascunhos) {
        const linhas = await prisma.treinamentoProgresso.findMany({
          where: { aula_id: { in: aulaIds } },
          select: { aula_id: true, ator_tipo: true, ator_id: true },
        })
        const porAula = new Map(visiveis.flatMap((t) => t.aulas.map((a) => [a.id, t.id])))
        const contagem = new Map()
        linhas.forEach((l) => {
          const chave = `${porAula.get(l.aula_id)}|${l.ator_tipo}:${l.ator_id}`
          contagem.set(chave, (contagem.get(chave) || 0) + 1)
        })
        concluiramPor = new Map()
        visiveis.forEach((t) => {
          let n = 0
          const atores = new Set([...contagem.keys()].filter((k) => k.startsWith(`${t.id}|`)))
          atores.forEach((k) => {
            if (contagem.get(k) >= t.aulas.length && t.aulas.length > 0) n += 1
          })
          concluiramPor.set(t.id, n)
        })
      }

      const data = visiveis.map(({ aulas, ...t }) => ({
        ...t,
        total_aulas: aulas.length,
        aulas_concluidas: aulas.filter((a) => concluidas.has(a.id)).length,
        miniatura_video: aulas.find((a) => a.video_id)?.video_id || null,
        ...(concluiramPor ? { pessoas_concluiram: concluiramPor.get(t.id) || 0 } : {}),
      }))
      return res.json({ success: true, data, total: data.length, pode_gerenciar: ehGestor(req) })
    } catch (error) {
      console.error("Erro ao listar treinamentos:", error)
      return res.status(500).json({ success: false, message: "Erro ao listar os treinamentos" })
    }
  },

  /** GET /treinamentos/:id — aulas, anexos e o que o usuário já concluiu. */
  async obter(req, res) {
    try {
      const id = idDe(req)
      if (id === null) return res.status(400).json({ success: false, message: "ID inválido" })
      const t = await carregarTreinamento(req, res, id)
      if (!t) return

      const aulas = await prisma.treinamentoAula.findMany({
        where: { treinamento_id: id },
        orderBy: [{ ordem: "asc" }, { id: "asc" }],
        select: AULA_SELECT,
      })
      const ator = autorDe(req)
      const concluidas = (
        await prisma.treinamentoProgresso.findMany({
          where: { aula_id: { in: aulas.map((a) => a.id) }, ator_tipo: ator.tipo, ator_id: ator.id },
          select: { aula_id: true },
        })
      ).map((p) => p.aula_id)

      return res.json({
        success: true,
        data: { ...t, aulas: aulas.map((a) => ({ ...a, concluida: concluidas.includes(a.id) })), pode_gerenciar: ehGestor(req) },
      })
    } catch (error) {
      console.error("Erro ao abrir treinamento:", error)
      return res.status(500).json({ success: false, message: "Erro ao abrir o treinamento" })
    }
  },

  /** POST /treinamentos/aulas/:id/concluir e DELETE (desmarcar). */
  async concluir(req, res) {
    const aulaId = idDe(req)
    if (aulaId === null) return res.status(400).json({ success: false, message: "ID inválido" })
    try {
      const aula = await prisma.treinamentoAula.findUnique({ where: { id: aulaId }, include: { treinamento: true } })
      if (!aula || !podeVer(req, aula.treinamento)) {
        return res.status(404).json({ success: false, message: "Aula não encontrada" })
      }
      const ator = autorDe(req)
      await prisma.treinamentoProgresso.upsert({
        where: { aula_id_ator_tipo_ator_id: { aula_id: aulaId, ator_tipo: ator.tipo, ator_id: ator.id } },
        create: { aula_id: aulaId, ator_tipo: ator.tipo, ator_id: ator.id },
        update: {},
      })
      return res.json({ success: true, message: "Aula concluída" })
    } catch (error) {
      console.error("Erro ao concluir aula:", error)
      return res.status(500).json({ success: false, message: "Erro ao registrar o progresso" })
    }
  },

  async desmarcar(req, res) {
    const aulaId = idDe(req)
    if (aulaId === null) return res.status(400).json({ success: false, message: "ID inválido" })
    try {
      const ator = autorDe(req)
      await prisma.treinamentoProgresso.deleteMany({ where: { aula_id: aulaId, ator_tipo: ator.tipo, ator_id: ator.id } })
      return res.json({ success: true, message: "Aula desmarcada" })
    } catch (error) {
      console.error("Erro ao desmarcar aula:", error)
      return res.status(500).json({ success: false, message: "Erro ao registrar o progresso" })
    }
  },

  // ------------------------------------------------------------------ gestão: treinamentos

  /** POST /treinamentos { titulo, descricao, categoria, capaUrl, visibilidade } */
  async criar(req, res) {
    if (!exigirGestor(req, res)) return
    const corpo = req.body || {}
    const titulo = texto(corpo.titulo, 255)
    if (!titulo) return res.status(400).json({ success: false, message: "Dê um título ao treinamento" })
    const visibilidade = VISIBILIDADES.includes(corpo.visibilidade) ? corpo.visibilidade : "todos"

    try {
      const autor = autorDe(req)
      const t = await prisma.treinamento.create({
        data: {
          titulo,
          descricao: corpo.descricao ? texto(corpo.descricao, 5000) : null,
          categoria: texto(corpo.categoria, 100) || "Geral",
          capa_url: corpo.capaUrl ? texto(corpo.capaUrl, 500) : null,
          visibilidade,
          autor_tipo: autor.tipo,
          autor_id: autor.id,
          autor_nome: autor.nome,
        },
      })
      registrar(req, { acao: "treinamento.criado", entidade: "treinamento", entidadeId: t.id, depois: t })
      return res.status(201).json({ success: true, message: "Treinamento criado", data: t })
    } catch (error) {
      console.error("Erro ao criar treinamento:", error)
      return res.status(500).json({ success: false, message: "Erro ao criar o treinamento" })
    }
  },

  /** PUT /treinamentos/:id */
  async atualizar(req, res) {
    if (!exigirGestor(req, res)) return
    const id = idDe(req)
    if (id === null) return res.status(400).json({ success: false, message: "ID inválido" })
    const corpo = req.body || {}
    try {
      const atual = await prisma.treinamento.findUnique({ where: { id } })
      if (!atual) return res.status(404).json({ success: false, message: "Treinamento não encontrado" })

      const data = {}
      if (corpo.titulo !== undefined) {
        const titulo = texto(corpo.titulo, 255)
        if (!titulo) return res.status(400).json({ success: false, message: "O título não pode ficar vazio" })
        data.titulo = titulo
      }
      if (corpo.descricao !== undefined) data.descricao = corpo.descricao ? texto(corpo.descricao, 5000) : null
      if (corpo.categoria !== undefined) data.categoria = texto(corpo.categoria, 100) || "Geral"
      if (corpo.capaUrl !== undefined) data.capa_url = corpo.capaUrl ? texto(corpo.capaUrl, 500) : null
      if (corpo.visibilidade !== undefined) {
        if (!VISIBILIDADES.includes(corpo.visibilidade)) {
          return res.status(400).json({ success: false, message: `Visibilidade deve ser uma de: ${VISIBILIDADES.join(", ")}` })
        }
        data.visibilidade = corpo.visibilidade
      }
      if (Object.keys(data).length === 0) return res.status(400).json({ success: false, message: "Nenhuma alteração informada" })

      const t = await prisma.treinamento.update({ where: { id }, data })
      registrar(req, { acao: "treinamento.editado", entidade: "treinamento", entidadeId: id, ...diferenca(atual, data) })
      return res.json({ success: true, message: "Treinamento atualizado", data: t })
    } catch (error) {
      console.error("Erro ao atualizar treinamento:", error)
      return res.status(500).json({ success: false, message: "Erro ao atualizar o treinamento" })
    }
  },

  /** PATCH /treinamentos/:id/publicar { publicado } */
  async publicar(req, res) {
    if (!exigirGestor(req, res)) return
    const id = idDe(req)
    if (id === null) return res.status(400).json({ success: false, message: "ID inválido" })
    const publicado = req.body?.publicado !== false
    try {
      const atual = await prisma.treinamento.findUnique({ where: { id }, include: { _count: { select: { aulas: true } } } })
      if (!atual) return res.status(404).json({ success: false, message: "Treinamento não encontrado" })
      if (publicado && atual._count.aulas === 0) {
        return res.status(400).json({ success: false, message: "Cadastre pelo menos uma aula antes de publicar" })
      }
      const status = publicado ? "publicado" : "rascunho"
      await prisma.treinamento.update({ where: { id }, data: { status }, select: { id: true } })
      registrar(req, {
        acao: publicado ? "treinamento.publicado" : "treinamento.despublicado",
        entidade: "treinamento",
        entidadeId: id,
        antes: { status: atual.status },
        depois: { status },
      })
      return res.json({ success: true, message: publicado ? "Treinamento publicado" : "Treinamento voltou para rascunho", data: { status } })
    } catch (error) {
      console.error("Erro ao publicar treinamento:", error)
      return res.status(500).json({ success: false, message: "Erro ao alterar a publicação" })
    }
  },

  /** DELETE /treinamentos/:id — apaga aulas, anexos (inclusive os arquivos) e progresso. */
  async excluir(req, res) {
    if (!exigirGestor(req, res)) return
    const id = idDe(req)
    if (id === null) return res.status(400).json({ success: false, message: "ID inválido" })
    try {
      const atual = await prisma.treinamento.findUnique({
        where: { id },
        include: { aulas: { include: { anexos: { select: { url: true } } } } },
      })
      if (!atual) return res.status(404).json({ success: false, message: "Treinamento não encontrado" })

      await prisma.treinamento.delete({ where: { id } })
      await removerArquivos(atual.aulas.flatMap((a) => a.anexos.map((x) => x.url)))
      const { aulas, ...resumo } = atual
      registrar(req, {
        acao: "treinamento.excluido",
        entidade: "treinamento",
        entidadeId: id,
        antes: { ...resumo, aulas: aulas.map((a) => a.titulo) },
      })
      return res.json({ success: true, message: "Treinamento excluído" })
    } catch (error) {
      console.error("Erro ao excluir treinamento:", error)
      return res.status(500).json({ success: false, message: "Erro ao excluir o treinamento" })
    }
  },

  // ------------------------------------------------------------------ gestão: aulas

  /** Valida o link do YouTube; devolve { url, id } ou lança mensagem amigável. */
  _video(videoUrl) {
    if (videoUrl === undefined) return undefined
    if (!videoUrl || !String(videoUrl).trim()) return { url: null, id: null }
    const id = extrairVideoYoutube(videoUrl)
    if (!id) throw new Error("O link não é um vídeo válido do YouTube")
    return { url: `https://www.youtube.com/watch?v=${id}`, id }
  },

  /** POST /treinamentos/:id/aulas { titulo, texto, videoUrl } */
  async criarAula(req, res) {
    if (!exigirGestor(req, res)) return
    const treinamentoId = idDe(req)
    if (treinamentoId === null) return res.status(400).json({ success: false, message: "ID inválido" })
    const corpo = req.body || {}
    const titulo = texto(corpo.titulo, 255)
    if (!titulo) return res.status(400).json({ success: false, message: "Dê um título à aula" })

    let video
    try {
      video = TreinamentosController._video(corpo.videoUrl)
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message })
    }

    try {
      const t = await prisma.treinamento.findUnique({ where: { id: treinamentoId }, select: { id: true } })
      if (!t) return res.status(404).json({ success: false, message: "Treinamento não encontrado" })
      const ultima = await prisma.treinamentoAula.findFirst({
        where: { treinamento_id: treinamentoId },
        orderBy: { ordem: "desc" },
        select: { ordem: true },
      })
      const aula = await prisma.treinamentoAula.create({
        data: {
          treinamento_id: treinamentoId,
          titulo,
          texto: limparTexto(corpo.texto) ?? null,
          video_url: video?.url ?? null,
          video_id: video?.id ?? null,
          ordem: (ultima?.ordem ?? -1) + 1,
        },
        select: AULA_SELECT,
      })
      registrar(req, { acao: "treinamento.aula_criada", entidade: "treinamento", entidadeId: treinamentoId, depois: { aula: aula.titulo } })
      return res.status(201).json({ success: true, message: "Aula criada", data: aula })
    } catch (error) {
      console.error("Erro ao criar aula:", error)
      return res.status(500).json({ success: false, message: "Erro ao criar a aula" })
    }
  },

  /** PUT /treinamentos/aulas/:id */
  async atualizarAula(req, res) {
    if (!exigirGestor(req, res)) return
    const id = idDe(req)
    if (id === null) return res.status(400).json({ success: false, message: "ID inválido" })
    const corpo = req.body || {}

    let video
    try {
      video = TreinamentosController._video(corpo.videoUrl)
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message })
    }

    try {
      const atual = await prisma.treinamentoAula.findUnique({ where: { id } })
      if (!atual) return res.status(404).json({ success: false, message: "Aula não encontrada" })

      const data = {}
      if (corpo.titulo !== undefined) {
        const titulo = texto(corpo.titulo, 255)
        if (!titulo) return res.status(400).json({ success: false, message: "O título não pode ficar vazio" })
        data.titulo = titulo
      }
      if (corpo.texto !== undefined) data.texto = limparTexto(corpo.texto)
      if (video !== undefined) {
        data.video_url = video.url
        data.video_id = video.id
      }
      if (Object.keys(data).length === 0) return res.status(400).json({ success: false, message: "Nenhuma alteração informada" })

      const aula = await prisma.treinamentoAula.update({ where: { id }, data, select: AULA_SELECT })
      const { texto: _t1, ...semTexto } = data
      registrar(req, {
        acao: "treinamento.aula_editada",
        entidade: "treinamento",
        entidadeId: atual.treinamento_id,
        ...diferenca({ ...atual, texto: undefined }, { ...semTexto, ...(data.texto !== undefined ? { texto_alterado: true } : {}) }),
      })
      return res.json({ success: true, message: "Aula atualizada", data: aula })
    } catch (error) {
      console.error("Erro ao atualizar aula:", error)
      return res.status(500).json({ success: false, message: "Erro ao atualizar a aula" })
    }
  },

  /** DELETE /treinamentos/aulas/:id */
  async excluirAula(req, res) {
    if (!exigirGestor(req, res)) return
    const id = idDe(req)
    if (id === null) return res.status(400).json({ success: false, message: "ID inválido" })
    try {
      const atual = await prisma.treinamentoAula.findUnique({ where: { id }, include: { anexos: { select: { url: true } } } })
      if (!atual) return res.status(404).json({ success: false, message: "Aula não encontrada" })
      await prisma.treinamentoAula.delete({ where: { id } })
      await removerArquivos(atual.anexos.map((x) => x.url))
      registrar(req, { acao: "treinamento.aula_excluida", entidade: "treinamento", entidadeId: atual.treinamento_id, antes: { aula: atual.titulo } })
      return res.json({ success: true, message: "Aula excluída" })
    } catch (error) {
      console.error("Erro ao excluir aula:", error)
      return res.status(500).json({ success: false, message: "Erro ao excluir a aula" })
    }
  },

  /** PATCH /treinamentos/:id/aulas/ordem { ids: [aulaId, ...] } — a nova ordem completa. */
  async ordenarAulas(req, res) {
    if (!exigirGestor(req, res)) return
    const treinamentoId = idDe(req)
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : []
    if (treinamentoId === null || ids.length === 0 || ids.some((n) => !Number.isFinite(n))) {
      return res.status(400).json({ success: false, message: "Informe a lista de aulas na nova ordem" })
    }
    try {
      const existentes = await prisma.treinamentoAula.findMany({ where: { treinamento_id: treinamentoId }, select: { id: true } })
      const mesmos = existentes.length === ids.length && existentes.every((a) => ids.includes(a.id))
      if (!mesmos) return res.status(400).json({ success: false, message: "A lista não corresponde às aulas do treinamento" })

      await prisma.$transaction(ids.map((aulaId, i) => prisma.treinamentoAula.update({ where: { id: aulaId }, data: { ordem: i }, select: { id: true } })))
      registrar(req, { acao: "treinamento.aulas_reordenadas", entidade: "treinamento", entidadeId: treinamentoId, depois: { ordem: ids } })
      return res.json({ success: true, message: "Ordem atualizada" })
    } catch (error) {
      console.error("Erro ao ordenar aulas:", error)
      return res.status(500).json({ success: false, message: "Erro ao reordenar as aulas" })
    }
  },

  // ------------------------------------------------------------------ gestão: anexos

  /** POST /treinamentos/aulas/:id/anexos (multipart, campo "arquivos") */
  async enviarAnexos(req, res) {
    if (!exigirGestor(req, res)) return
    const aulaId = idDe(req)
    if (aulaId === null) return res.status(400).json({ success: false, message: "ID inválido" })
    const arquivos = req.files || []
    if (arquivos.length === 0) return res.status(400).json({ success: false, message: "Escolha pelo menos um arquivo" })

    const invalido = arquivos.find((f) => !TIPOS_ANEXO.has(f.mimetype))
    if (invalido) {
      return res.status(400).json({
        success: false,
        message: `Tipo de arquivo não aceito: ${fixFileName(invalido.originalname)}. Use PDF, Office, imagem, texto ou zip.`,
      })
    }

    try {
      const aula = await prisma.treinamentoAula.findUnique({ where: { id: aulaId }, include: { _count: { select: { anexos: true } } } })
      if (!aula) return res.status(404).json({ success: false, message: "Aula não encontrada" })
      if (aula._count.anexos + arquivos.length > MAX_ANEXOS_POR_AULA) {
        return res.status(400).json({ success: false, message: `Cada aula aceita até ${MAX_ANEXOS_POR_AULA} anexos` })
      }

      const ultimo = await prisma.treinamentoAnexo.findFirst({ where: { aula_id: aulaId }, orderBy: { ordem: "desc" }, select: { ordem: true } })
      let ordem = (ultimo?.ordem ?? -1) + 1
      const criados = []
      for (const file of arquivos) {
        const { publicUrl } = await uploadPublicBuffer({ bucket: BUCKET, folder: `aula-${aulaId}`, file })
        criados.push(
          await prisma.treinamentoAnexo.create({
            data: { aula_id: aulaId, nome: texto(fixFileName(file.originalname), 255), url: publicUrl, tamanho: file.size, tipo: file.mimetype, ordem: ordem++ },
            select: { id: true, nome: true, url: true, tamanho: true, tipo: true, ordem: true },
          }),
        )
      }
      registrar(req, {
        acao: "treinamento.anexo_adicionado",
        entidade: "treinamento",
        entidadeId: aula.treinamento_id,
        depois: { aula: aula.titulo, arquivos: criados.map((c) => c.nome) },
      })
      return res.status(201).json({ success: true, message: `${criados.length} arquivo(s) anexado(s)`, data: criados })
    } catch (error) {
      console.error("Erro ao anexar arquivos:", error)
      return res.status(500).json({ success: false, message: "Erro ao enviar os arquivos" })
    }
  },

  /** PATCH /treinamentos/anexos/:id { nome } */
  async renomearAnexo(req, res) {
    if (!exigirGestor(req, res)) return
    const id = idDe(req)
    const nome = texto(req.body?.nome, 255)
    if (id === null || !nome) return res.status(400).json({ success: false, message: "Informe o novo nome do arquivo" })
    try {
      const atual = await prisma.treinamentoAnexo.findUnique({ where: { id } })
      if (!atual) return res.status(404).json({ success: false, message: "Anexo não encontrado" })
      await prisma.treinamentoAnexo.update({ where: { id }, data: { nome }, select: { id: true } })
      return res.json({ success: true, message: "Anexo renomeado", data: { nome } })
    } catch (error) {
      console.error("Erro ao renomear anexo:", error)
      return res.status(500).json({ success: false, message: "Erro ao renomear o anexo" })
    }
  },

  /** DELETE /treinamentos/anexos/:id */
  async excluirAnexo(req, res) {
    if (!exigirGestor(req, res)) return
    const id = idDe(req)
    if (id === null) return res.status(400).json({ success: false, message: "ID inválido" })
    try {
      const atual = await prisma.treinamentoAnexo.findUnique({ where: { id }, include: { aula: { select: { treinamento_id: true, titulo: true } } } })
      if (!atual) return res.status(404).json({ success: false, message: "Anexo não encontrado" })
      await prisma.treinamentoAnexo.delete({ where: { id } })
      await removerArquivos([atual.url])
      registrar(req, {
        acao: "treinamento.anexo_removido",
        entidade: "treinamento",
        entidadeId: atual.aula.treinamento_id,
        antes: { aula: atual.aula.titulo, arquivo: atual.nome },
      })
      return res.json({ success: true, message: "Anexo removido" })
    } catch (error) {
      console.error("Erro ao excluir anexo:", error)
      return res.status(500).json({ success: false, message: "Erro ao remover o anexo" })
    }
  },

  // ------------------------------------------------------------------ pedidos de novos treinamentos

  /** POST /treinamentos/pedidos { titulo, descricao } — qualquer perfil logado. */
  async criarPedido(req, res) {
    const titulo = texto(req.body?.titulo, 255)
    if (!titulo) return res.status(400).json({ success: false, message: "Diga qual treinamento você precisa" })
    try {
      const autor = autorDe(req)
      const pedido = await prisma.treinamentoPedido.create({
        data: {
          titulo,
          descricao: req.body?.descricao ? texto(req.body.descricao, 3000) : null,
          autor_tipo: autor.tipo,
          autor_id: autor.id,
          autor_nome: autor.nome,
        },
      })
      registrar(req, { acao: "treinamento.pedido_criado", entidade: "treinamento_pedido", entidadeId: pedido.id, depois: { titulo } })
      return res.status(201).json({ success: true, message: "Pedido enviado. A coordenação vai analisar.", data: pedido })
    } catch (error) {
      console.error("Erro ao criar pedido de treinamento:", error)
      return res.status(500).json({ success: false, message: "Erro ao enviar o pedido" })
    }
  },

  /** GET /treinamentos/pedidos/meus */
  async meusPedidos(req, res) {
    try {
      const autor = autorDe(req)
      const pedidos = await prisma.treinamentoPedido.findMany({
        where: { autor_tipo: autor.tipo, autor_id: autor.id },
        orderBy: { created_at: "desc" },
        take: 50,
      })
      return res.json({ success: true, data: pedidos })
    } catch (error) {
      console.error("Erro ao listar meus pedidos:", error)
      return res.status(500).json({ success: false, message: "Erro ao listar os pedidos" })
    }
  },

  /** GET /treinamentos/pedidos?status= — gestão. */
  async listarPedidos(req, res) {
    if (!exigirGestor(req, res)) return
    try {
      const status = String(req.query.status || "")
      const pedidos = await prisma.treinamentoPedido.findMany({
        where: STATUS_PEDIDO.includes(status) ? { status } : {},
        orderBy: { created_at: "desc" },
        take: 200,
      })
      return res.json({ success: true, data: pedidos })
    } catch (error) {
      console.error("Erro ao listar pedidos:", error)
      return res.status(500).json({ success: false, message: "Erro ao listar os pedidos" })
    }
  },

  /** PATCH /treinamentos/pedidos/:id { status, resposta } */
  async responderPedido(req, res) {
    if (!exigirGestor(req, res)) return
    const id = idDe(req)
    if (id === null) return res.status(400).json({ success: false, message: "ID inválido" })
    const { status, resposta } = req.body || {}
    if (status !== undefined && !STATUS_PEDIDO.includes(status)) {
      return res.status(400).json({ success: false, message: `Status deve ser um de: ${STATUS_PEDIDO.join(", ")}` })
    }
    try {
      const atual = await prisma.treinamentoPedido.findUnique({ where: { id } })
      if (!atual) return res.status(404).json({ success: false, message: "Pedido não encontrado" })

      const data = {}
      if (status !== undefined) data.status = status
      if (resposta !== undefined) {
        data.resposta = resposta ? texto(resposta, 3000) : null
        data.respondido_por = autorDe(req).nome
        data.respondido_em = new Date()
      }
      if (Object.keys(data).length === 0) return res.status(400).json({ success: false, message: "Nenhuma alteração informada" })

      const pedido = await prisma.treinamentoPedido.update({ where: { id }, data })
      registrar(req, { acao: "treinamento.pedido_respondido", entidade: "treinamento_pedido", entidadeId: id, ...diferenca(atual, data) })
      return res.json({ success: true, message: "Pedido atualizado", data: pedido })
    } catch (error) {
      console.error("Erro ao responder pedido:", error)
      return res.status(500).json({ success: false, message: "Erro ao atualizar o pedido" })
    }
  },
}

module.exports = TreinamentosController
