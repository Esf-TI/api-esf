require("dotenv").config()
const { Pool } = require("pg")
const { PrismaPg } = require("@prisma/adapter-pg")
const { PrismaClient } = require("@prisma/client")
const supabase = require("../lib/supabaseClient")
const { uploadPublicFile } = require("../lib/storageService")

const BUCKET = "transparencia"
const PLACEHOLDER_PATH = "placeholders/em-breve.pdf"

/** Cards padrão da página pública de Transparência */
const CARDS_PADRAO = [
  {
    titulo: "Estatuto",
    descricao:
      "Aqui você encontrará informações detalhadas sobre as regras e regulamentos que regem nossa organização.",
    categoria: "Documentos Institucionais",
    arquivo_nome: "em-breve.pdf",
  },
  {
    titulo: "Governança",
    descricao: "Entenda sobre a nossa governança e sua importância em nossa organização.",
    categoria: "Governança",
    arquivo_nome: "em-breve.pdf",
  },
  {
    titulo: "Documentos Contábeis",
    descricao:
      "Clique aqui para explorar nossos relatórios financeiros, demonstrações de resultados e balanços patrimoniais.",
    categoria: "Prestação de Contas",
    arquivo_nome: "em-breve.pdf",
  },
  {
    titulo: "Auditorias Financeiras",
    descricao:
      "Explore nossa seção de Auditoria Financeira para obter uma análise detalhada e transparente das nossas finanças.",
    categoria: "Auditoria",
    arquivo_nome: "em-breve.pdf",
  },
]

/** PDF mínimo válido (placeholder “em breve”) */
const PLACEHOLDER_PDF = Buffer.from(
  `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000052 00000 n 
0000000101 00000 n 
trailer<</Size 4/Root 1 0 R>>
startxref
178
%%EOF`,
  "utf-8",
)

async function ensurePlaceholderUrl() {
  const { data: existing } = supabase.storage.from(BUCKET).getPublicUrl(PLACEHOLDER_PATH)
  const publicUrl = existing?.publicUrl

  const { data: list } = await supabase.storage.from(BUCKET).list("placeholders", { search: "em-breve.pdf" })
  if (list?.some((f) => f.name === "em-breve.pdf")) {
    return publicUrl
  }

  const { error } = await supabase.storage.from(BUCKET).upload(PLACEHOLDER_PATH, PLACEHOLDER_PDF, {
    contentType: "application/pdf",
    upsert: true,
  })
  if (error) {
    const uploaded = await uploadPublicFile({
      bucket: BUCKET,
      folder: "placeholders",
      fileName: "em-breve.pdf",
      fileBuffer: PLACEHOLDER_PDF,
      contentType: "application/pdf",
    })
    return uploaded.publicUrl
  }
  return publicUrl
}

async function seedTransparenciaPadrao() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL ausente no .env")
  }

  const placeholderUrl = await ensurePlaceholderUrl()
  console.log("[seed-transparencia] Placeholder:", placeholderUrl)

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    for (const card of CARDS_PADRAO) {
      const existente = await prisma.documentoTransparencia.findFirst({
        where: { titulo: card.titulo },
      })

      if (existente) {
        console.log("[seed-transparencia] Já existe:", card.titulo)
        continue
      }

      await prisma.documentoTransparencia.create({
        data: {
          titulo: card.titulo,
          descricao: card.descricao,
          categoria: card.categoria,
          arquivo_url: placeholderUrl,
          arquivo_nome: card.arquivo_nome,
          arquivo_tamanho: PLACEHOLDER_PDF.length,
          created_by: null,
        },
      })
      console.log("[seed-transparencia] Criado:", card.titulo)
    }
    console.log("[seed-transparencia] Concluído.")
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

if (require.main === module) {
  seedTransparenciaPadrao().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

module.exports = { seedTransparenciaPadrao, CARDS_PADRAO }
