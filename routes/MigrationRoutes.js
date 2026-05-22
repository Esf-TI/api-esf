const express = require("express")
const router = express.Router()
const prisma = require("../lib/prismaClient")

const OLD1 = "https://supabase.esf-brasil.cloud"
const NEW1 = "https://storage.esf.org.br"
const OLD2 = "https://bd.esf.org.br/site-assets/"
const NEW2 = "https://storage.esf.org.br/storage/v1/object/public/site-assets/"

const QUERIES = [
  [`UPDATE "Nucleo" SET "fotoCapa" = REPLACE("fotoCapa", '${OLD1}', '${NEW1}') WHERE "fotoCapa" LIKE '%${OLD1}%'`, "Nucleo.fotoCapa (esf-brasil)"],
  [`UPDATE "Nucleo" SET "fotoCapa" = REPLACE("fotoCapa", '${OLD2}', '${NEW2}') WHERE "fotoCapa" LIKE '%bd.esf.org.br%'`, "Nucleo.fotoCapa (bd)"],
  [`UPDATE "Nucleo" SET "foto1"   = REPLACE("foto1",   '${OLD1}', '${NEW1}') WHERE "foto1"   LIKE '%${OLD1}%'`, "Nucleo.foto1"],
  [`UPDATE "Nucleo" SET "foto2"   = REPLACE("foto2",   '${OLD1}', '${NEW1}') WHERE "foto2"   LIKE '%${OLD1}%'`, "Nucleo.foto2"],
  [`UPDATE "Nucleo" SET "foto3"   = REPLACE("foto3",   '${OLD1}', '${NEW1}') WHERE "foto3"   LIKE '%${OLD1}%'`, "Nucleo.foto3"],
  [`UPDATE "Nucleo" SET "logoUrl" = REPLACE("logoUrl", '${OLD1}', '${NEW1}') WHERE "logoUrl" LIKE '%${OLD1}%'`, "Nucleo.logoUrl (esf-brasil)"],
  [`UPDATE "Nucleo" SET "logoUrl" = REPLACE("logoUrl", '${OLD2}', '${NEW2}') WHERE "logoUrl" LIKE '%bd.esf.org.br%'`, "Nucleo.logoUrl (bd)"],

  [`UPDATE "Projeto" SET "fotoCapa" = REPLACE("fotoCapa", '${OLD1}', '${NEW1}') WHERE "fotoCapa" LIKE '%${OLD1}%'`, "Projeto.fotoCapa (esf-brasil)"],
  [`UPDATE "Projeto" SET "fotoCapa" = REPLACE("fotoCapa", '${OLD2}', '${NEW2}') WHERE "fotoCapa" LIKE '%bd.esf.org.br%'`, "Projeto.fotoCapa (bd)"],
  [`UPDATE "Projeto" SET "foto1" = REPLACE("foto1", '${OLD1}', '${NEW1}') WHERE "foto1" LIKE '%${OLD1}%'`, "Projeto.foto1"],
  [`UPDATE "Projeto" SET "foto2" = REPLACE("foto2", '${OLD1}', '${NEW1}') WHERE "foto2" LIKE '%${OLD1}%'`, "Projeto.foto2"],
  [`UPDATE "Projeto" SET "foto3" = REPLACE("foto3", '${OLD1}', '${NEW1}') WHERE "foto3" LIKE '%${OLD1}%'`, "Projeto.foto3"],
  [`UPDATE "Projeto" SET "foto4" = REPLACE("foto4", '${OLD1}', '${NEW1}') WHERE "foto4" LIKE '%${OLD1}%'`, "Projeto.foto4"],
  [`UPDATE "Projeto" SET "foto5" = REPLACE("foto5", '${OLD1}', '${NEW1}') WHERE "foto5" LIKE '%${OLD1}%'`, "Projeto.foto5"],

  [`UPDATE "Anais" SET "pdf_url"         = REPLACE("pdf_url",         '${OLD1}', '${NEW1}') WHERE "pdf_url"         LIKE '%${OLD1}%'`, "Anais.pdf_url (esf-brasil)"],
  [`UPDATE "Anais" SET "pdf_url"         = REPLACE("pdf_url",         '${OLD2}', '${NEW2}') WHERE "pdf_url"         LIKE '%bd.esf.org.br%'`, "Anais.pdf_url (bd)"],
  [`UPDATE "Anais" SET "cover_image_url" = REPLACE("cover_image_url", '${OLD1}', '${NEW1}') WHERE "cover_image_url" LIKE '%${OLD1}%'`, "Anais.cover_image_url"],

  [`UPDATE "Blog" SET "imageUrl" = REPLACE("imageUrl", '${OLD1}', '${NEW1}') WHERE "imageUrl" LIKE '%${OLD1}%'`, "Blog.imageUrl (esf-brasil)"],
  [`UPDATE "Blog" SET "imageUrl" = REPLACE("imageUrl", '${OLD2}', '${NEW2}') WHERE "imageUrl" LIKE '%bd.esf.org.br%'`, "Blog.imageUrl (bd)"],

  [`UPDATE "documentoTransparencia" SET "arquivo_url" = REPLACE("arquivo_url", '${OLD1}', '${NEW1}') WHERE "arquivo_url" LIKE '%${OLD1}%'`, "documentoTransparencia.arquivo_url (esf-brasil)"],
  [`UPDATE "documentoTransparencia" SET "arquivo_url" = REPLACE("arquivo_url", '${OLD2}', '${NEW2}') WHERE "arquivo_url" LIKE '%bd.esf.org.br%'`, "documentoTransparencia.arquivo_url (bd)"],
]

// POST /admin/migrate-urls
// Header: x-migration-secret: <MIGRATION_SECRET do .env>
router.post("/migrate-urls", async (req, res) => {
  const secret = req.headers["x-migration-secret"]
  const expectedSecret = process.env.MIGRATION_SECRET || process.env.JWT_SECRET

  if (!secret || secret !== expectedSecret) {
    return res.status(403).json({ success: false, message: "Acesso negado" })
  }

  const results = []
  let total = 0

  for (const [sql, label] of QUERIES) {
    try {
      const rows = await prisma.$executeRawUnsafe(sql)
      results.push({ campo: label, linhas: rows, ok: true })
      if (rows > 0) total += rows
    } catch (e) {
      results.push({ campo: label, erro: e.message.split("\n")[0], ok: false })
    }
  }

  const updated = results.filter((r) => r.ok && r.linhas > 0)
  const failed  = results.filter((r) => !r.ok)

  res.json({
    success: true,
    message: `Migração concluída. ${total} registro(s) atualizado(s).`,
    total,
    updated,
    failed: failed.length > 0 ? failed : undefined,
  })
})

module.exports = router
