/**
 * Migração de URLs antigas do Supabase → storage.esf.org.br
 * Execute com: node fix-supabase-urls.js  (na pasta backend/)
 */
require("dotenv").config()
const prisma = require("./lib/prismaClient")

const OLD = "https://supabase.esf-brasil.cloud"
const NEW = "https://storage.esf.org.br"

const OLD2 = "https://bd.esf.org.br/site-assets/"
const NEW2 = "https://storage.esf.org.br/storage/v1/object/public/site-assets/"

async function run() {
  console.log("🔄 Migrando URLs antigas do Supabase...\n")
  let total = 0

  const queries = [
    // Nucleo
    prisma.$executeRawUnsafe(`UPDATE "Nucleo" SET "fotoCapa" = REPLACE("fotoCapa", '${OLD}', '${NEW}') WHERE "fotoCapa" LIKE '%${OLD}%'`),
    prisma.$executeRawUnsafe(`UPDATE "Nucleo" SET "fotoCapa" = REPLACE("fotoCapa", '${OLD2}', '${NEW2}') WHERE "fotoCapa" LIKE '%bd.esf.org.br%'`),
    prisma.$executeRawUnsafe(`UPDATE "Nucleo" SET "foto1" = REPLACE("foto1", '${OLD}', '${NEW}') WHERE "foto1" LIKE '%${OLD}%'`),
    prisma.$executeRawUnsafe(`UPDATE "Nucleo" SET "foto2" = REPLACE("foto2", '${OLD}', '${NEW}') WHERE "foto2" LIKE '%${OLD}%'`),
    prisma.$executeRawUnsafe(`UPDATE "Nucleo" SET "foto3" = REPLACE("foto3", '${OLD}', '${NEW}') WHERE "foto3" LIKE '%${OLD}%'`),
    prisma.$executeRawUnsafe(`UPDATE "Nucleo" SET "logoUrl" = REPLACE("logoUrl", '${OLD}', '${NEW}') WHERE "logoUrl" LIKE '%${OLD}%'`),
    prisma.$executeRawUnsafe(`UPDATE "Nucleo" SET "logoUrl" = REPLACE("logoUrl", '${OLD2}', '${NEW2}') WHERE "logoUrl" LIKE '%bd.esf.org.br%'`),

    // Projeto
    prisma.$executeRawUnsafe(`UPDATE "Projeto" SET "fotoCapa" = REPLACE("fotoCapa", '${OLD}', '${NEW}') WHERE "fotoCapa" LIKE '%${OLD}%'`),
    prisma.$executeRawUnsafe(`UPDATE "Projeto" SET "fotoCapa" = REPLACE("fotoCapa", '${OLD2}', '${NEW2}') WHERE "fotoCapa" LIKE '%bd.esf.org.br%'`),
    prisma.$executeRawUnsafe(`UPDATE "Projeto" SET "foto1" = REPLACE("foto1", '${OLD}', '${NEW}') WHERE "foto1" LIKE '%${OLD}%'`),
    prisma.$executeRawUnsafe(`UPDATE "Projeto" SET "foto2" = REPLACE("foto2", '${OLD}', '${NEW}') WHERE "foto2" LIKE '%${OLD}%'`),
    prisma.$executeRawUnsafe(`UPDATE "Projeto" SET "foto3" = REPLACE("foto3", '${OLD}', '${NEW}') WHERE "foto3" LIKE '%${OLD}%'`),
    prisma.$executeRawUnsafe(`UPDATE "Projeto" SET "foto4" = REPLACE("foto4", '${OLD}', '${NEW}') WHERE "foto4" LIKE '%${OLD}%'`),
    prisma.$executeRawUnsafe(`UPDATE "Projeto" SET "foto5" = REPLACE("foto5", '${OLD}', '${NEW}') WHERE "foto5" LIKE '%${OLD}%'`),

    // Anais
    prisma.$executeRawUnsafe(`UPDATE "Anais" SET "pdf_url" = REPLACE("pdf_url", '${OLD}', '${NEW}') WHERE "pdf_url" LIKE '%${OLD}%'`),
    prisma.$executeRawUnsafe(`UPDATE "Anais" SET "pdf_url" = REPLACE("pdf_url", '${OLD2}', '${NEW2}') WHERE "pdf_url" LIKE '%bd.esf.org.br%'`),
    prisma.$executeRawUnsafe(`UPDATE "Anais" SET "cover_image_url" = REPLACE("cover_image_url", '${OLD}', '${NEW}') WHERE "cover_image_url" LIKE '%${OLD}%'`),

    // Blog
    prisma.$executeRawUnsafe(`UPDATE "Blog" SET "imageUrl" = REPLACE("imageUrl", '${OLD}', '${NEW}') WHERE "imageUrl" LIKE '%${OLD}%'`),
    prisma.$executeRawUnsafe(`UPDATE "Blog" SET "imageUrl" = REPLACE("imageUrl", '${OLD2}', '${NEW2}') WHERE "imageUrl" LIKE '%bd.esf.org.br%'`),

    // Transparência
    prisma.$executeRawUnsafe(`UPDATE "documentoTransparencia" SET "arquivo_url" = REPLACE("arquivo_url", '${OLD}', '${NEW}') WHERE "arquivo_url" LIKE '%${OLD}%'`),
    prisma.$executeRawUnsafe(`UPDATE "documentoTransparencia" SET "arquivo_url" = REPLACE("arquivo_url", '${OLD2}', '${NEW2}') WHERE "arquivo_url" LIKE '%bd.esf.org.br%'`),
  ]

  const labels = [
    "Nucleo.fotoCapa (1)", "Nucleo.fotoCapa (2)", "Nucleo.foto1", "Nucleo.foto2", "Nucleo.foto3", "Nucleo.logoUrl (1)", "Nucleo.logoUrl (2)",
    "Projeto.fotoCapa (1)", "Projeto.fotoCapa (2)", "Projeto.foto1", "Projeto.foto2", "Projeto.foto3", "Projeto.foto4", "Projeto.foto5",
    "Anais.pdf_url (1)", "Anais.pdf_url (2)", "Anais.cover_image_url",
    "Blog.imageUrl (1)", "Blog.imageUrl (2)",
    "documentoTransparencia.arquivo_url (1)", "documentoTransparencia.arquivo_url (2)",
  ]

  for (let i = 0; i < queries.length; i++) {
    try {
      const rows = await queries[i]
      if (rows > 0) {
        console.log(`  ✅  ${labels[i]}  →  ${rows} linha(s)`)
        total += rows
      }
    } catch (e) {
      console.log(`  ⚠️  ${labels[i]}  →  ${e.message.split("\n")[0]}`)
    }
  }

  console.log(`\n✔  Concluído! ${total} registro(s) atualizado(s) no banco.`)
}

run()
  .catch((e) => { console.error("❌ Erro fatal:", e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
