const prisma = require("../lib/prismaClient")
const supabase = require("../lib/supabaseClient")
const { uploadPublicBuffer } = require("../lib/storageService")
const { getPagination, buildMeta } = require("../lib/pagination")

const BUCKET = "materiais"

const TIPOS = ["arquivo", "link"]
const VISIBILIDADES = ["nucleos", "publico"]
const STATUS = ["active", "inactive"]

// O multer entrega file.originalname em latin1; re-decodifica para UTF-8
// (corrige acentos: "ApresentaÃ§Ã£o" -> "Apresentação").
function fixFileName(name) {
  if (!name) return name
  try {
    return Buffer.from(name, "latin1").toString("utf8")
  } catch {
    return name
  }
}

/** Caminho do objeto dentro do bucket, para remover do storage ao editar/excluir. */
function caminhoNoStorage(url) {
  if (!url) return null
  const match = String(url).match(new RegExp(`/storage/v1/object/public/${BUCKET}/(.+)`))
  return match ? match[1] : null
}

async function removerArquivo(url) {
  const caminho = caminhoNoStorage(url)
  if (!caminho) return
  try {
    await supabase.storage.from(BUCKET).remove([caminho])
  } catch (e) {
    console.warn("Não foi possível remover arquivo de material:", e.message)
  }
}

const MateriaisController = {
  /**
   * GET /materiais
   *
   * Passa por `authenticateOpcional`: visitante enxerga só o que foi marcado
   * como público, núcleo e admin enxergam o acervo inteiro. É isso que faz o
   * material "aparecer depois do login" sem precisar de uma segunda rota.
   */
  async listar(req, res) {
    try {
      const { categoria, busca, incluirInativos } = req.query
      const logado = Boolean(req.admin || req.nucleo || req.membro)

      const where = {}
      if (categoria) where.categoria = categoria
      if (!logado) where.visibilidade = "publico"

      // Material fora do ar só aparece para quem mantém o acervo.
      if (!(req.admin && String(incluirInativos) === "true")) where.status = "active"

      const termo = String(busca || "").trim()
      if (termo) {
        where.OR = [
          { titulo: { contains: termo, mode: "insensitive" } },
          { descricao: { contains: termo, mode: "insensitive" } },
          { arquivo_nome: { contains: termo, mode: "insensitive" } },
        ]
      }

      const pag = getPagination(req.query)
      const [materiais, total] = await Promise.all([
        prisma.material.findMany({
          where,
          orderBy: [{ categoria: "asc" }, { ordem: "asc" }, { created_at: "desc" }],
          include: { creator: { select: { id: true, nome: true } } },
          ...(pag.enabled ? { take: pag.take, skip: pag.skip } : {}),
        }),
        pag.enabled ? prisma.material.count({ where }) : Promise.resolve(undefined),
      ])

      res.json({ success: true, data: materiais, pagination: buildMeta(total, pag) })
    } catch (error) {
      console.error("Erro ao listar materiais:", error)
      res.status(500).json({ success: false, message: "Erro ao listar materiais" })
    }
  },

  async listarCategorias(req, res) {
    try {
      const logado = Boolean(req.admin || req.nucleo || req.membro)
      const where = { status: "active" }
      if (!logado) where.visibilidade = "publico"

      const categorias = await prisma.material.findMany({
        where,
        select: { categoria: true },
        distinct: ["categoria"],
        orderBy: { categoria: "asc" },
      })

      res.json({ success: true, data: categorias.map((c) => c.categoria) })
    } catch (error) {
      console.error("Erro ao listar categorias de materiais:", error)
      res.status(500).json({ success: false, message: "Erro ao listar categorias" })
    }
  },

  async buscarPorId(req, res) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) {
        return res.status(400).json({ success: false, message: "ID inválido" })
      }

      const material = await prisma.material.findUnique({
        where: { id },
        include: { creator: { select: { id: true, nome: true } } },
      })

      if (!material) {
        return res.status(404).json({ success: false, message: "Material não encontrado" })
      }

      const logado = Boolean(req.admin || req.nucleo || req.membro)
      if (!logado && material.visibilidade !== "publico") {
        return res.status(401).json({ success: false, message: "Entre com a conta do núcleo para ver este material" })
      }

      res.json({ success: true, data: material })
    } catch (error) {
      console.error("Erro ao buscar material:", error)
      res.status(500).json({ success: false, message: "Erro ao buscar material" })
    }
  },

  /**
   * POST /materiais
   *
   * Aceita vários arquivos de uma vez: a migração do site interno sobe dezenas
   * de modelos da mesma categoria, e um por requisição tornaria o trabalho
   * inviável. Mesmo desenho do controller de transparência — sobe tudo primeiro
   * e grava os registros numa transação, para não deixar acervo pela metade
   * quando um upload falha no meio do laço.
   */
  async criar(req, res) {
    try {
      const { titulo, descricao, categoria, link_externo } = req.body
      const tipo = TIPOS.includes(req.body.tipo) ? req.body.tipo : "arquivo"
      const visibilidade = VISIBILIDADES.includes(req.body.visibilidade) ? req.body.visibilidade : "nucleos"
      const ordem = Number.parseInt(req.body.ordem, 10) || 0

      if (!titulo || !categoria) {
        return res.status(400).json({ success: false, message: "Título e categoria são obrigatórios" })
      }

      if (tipo === "link") {
        if (!link_externo) {
          return res.status(400).json({ success: false, message: "Informe o link do material" })
        }

        const material = await prisma.material.create({
          data: {
            titulo,
            descricao: descricao || null,
            categoria,
            tipo: "link",
            link_externo,
            visibilidade,
            ordem,
            created_by: req.admin?.id || null,
          },
        })

        return res.status(201).json({ success: true, message: "Material criado com sucesso", data: material })
      }

      const arquivos = req.files || []
      if (arquivos.length === 0) {
        return res.status(400).json({ success: false, message: "Pelo menos um arquivo é obrigatório" })
      }

      const enviados = []
      for (const file of arquivos) {
        const { publicUrl } = await uploadPublicBuffer({ bucket: BUCKET, folder: categoria, file })
        enviados.push({ nomeArquivo: fixFileName(file.originalname), publicUrl, tamanho: file.size })
      }

      const criados = await prisma.$transaction(
        enviados.map((item) =>
          prisma.material.create({
            data: {
              titulo,
              descricao: descricao || null,
              categoria,
              tipo: "arquivo",
              arquivo_url: item.publicUrl,
              arquivo_nome: item.nomeArquivo,
              arquivo_tamanho: item.tamanho,
              visibilidade,
              ordem,
              created_by: req.admin?.id || null,
            },
          })
        )
      )

      res.status(201).json({
        success: true,
        message: `${criados.length} material(is) criado(s) com sucesso`,
        data: criados.length === 1 ? criados[0] : criados,
      })
    } catch (error) {
      console.error("Erro ao criar material:", error)
      res.status(500).json({ success: false, message: "Erro ao criar material", error: error.message })
    }
  },

  async atualizar(req, res) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) {
        return res.status(400).json({ success: false, message: "ID inválido" })
      }

      const existente = await prisma.material.findUnique({ where: { id } })
      if (!existente) {
        return res.status(404).json({ success: false, message: "Material não encontrado" })
      }

      const { titulo, descricao, categoria, link_externo, tipo, visibilidade, status, ordem } = req.body

      const dados = {}
      if (titulo) dados.titulo = titulo
      if (descricao !== undefined) dados.descricao = descricao || null
      if (categoria) dados.categoria = categoria
      if (VISIBILIDADES.includes(visibilidade)) dados.visibilidade = visibilidade
      if (STATUS.includes(status)) dados.status = status
      if (ordem !== undefined && Number.isFinite(Number.parseInt(ordem, 10))) {
        dados.ordem = Number.parseInt(ordem, 10)
      }

      const novoTipo = TIPOS.includes(tipo) ? tipo : existente.tipo

      if (novoTipo === "link") {
        const link = link_externo || existente.link_externo
        if (!link) {
          return res.status(400).json({ success: false, message: "Informe o link do material" })
        }
        // Virou link: o arquivo que estava no storage não tem mais quem o alcance.
        if (existente.arquivo_url) await removerArquivo(existente.arquivo_url)
        Object.assign(dados, {
          tipo: "link",
          link_externo: link,
          arquivo_url: null,
          arquivo_nome: null,
          arquivo_tamanho: null,
        })
      } else if (req.file) {
        await removerArquivo(existente.arquivo_url)
        const { publicUrl } = await uploadPublicBuffer({
          bucket: BUCKET,
          folder: categoria || existente.categoria,
          file: req.file,
        })
        Object.assign(dados, {
          tipo: "arquivo",
          arquivo_url: publicUrl,
          arquivo_nome: fixFileName(req.file.originalname),
          arquivo_tamanho: req.file.size,
          link_externo: null,
        })
      } else if (novoTipo === "arquivo" && existente.tipo === "link") {
        return res.status(400).json({ success: false, message: "Envie o arquivo ao trocar o material de link para arquivo" })
      }

      const material = await prisma.material.update({ where: { id }, data: dados })
      res.json({ success: true, data: material })
    } catch (error) {
      console.error("Erro ao atualizar material:", error)
      res.status(500).json({ success: false, message: "Erro ao atualizar material", error: error.message })
    }
  },

  async deletar(req, res) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) {
        return res.status(400).json({ success: false, message: "ID inválido" })
      }

      const existente = await prisma.material.findUnique({ where: { id } })
      if (!existente) {
        return res.status(404).json({ success: false, message: "Material não encontrado" })
      }

      await removerArquivo(existente.arquivo_url)
      await prisma.material.delete({ where: { id } })

      res.json({ success: true, message: "Material excluído com sucesso" })
    } catch (error) {
      console.error("Erro ao deletar material:", error)
      res.status(500).json({ success: false, message: "Erro ao deletar material" })
    }
  },
}

module.exports = MateriaisController
