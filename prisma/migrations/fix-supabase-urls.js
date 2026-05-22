/**
 * Migração de URLs antigas do Supabase → storage.esf.org.br
 * Execute com: node prisma/migrations/fix-supabase-urls.js
 */
const { PrismaClient } = require("@prisma/client")
require("dotenv").config()

const prisma = new PrismaClient()

const OLD_DOMAINS = [
  {
    old: "https://supabase.esf-brasil.cloud",
    new: "https://storage.esf.org.br",
  },
  {
    old: "https://bd.esf.org.br/site-assets/",
    new: "https://storage.esf.org.br/storage/v1/object/public/site-assets/",
  },
]

const TARGETS = [
  { model: "Nucleo",                  col: "fotoCapa"    },
  { model: "Nucleo",                  col: "foto1"       },
  { model: "Nucleo",                  col: "foto2"       },
  { model: "Nucleo",                  col: "foto3"       },
  { model: "Nucleo",                  col: "logoUrl"     },
  { model: "Projeto",                 col: "fotoCapa"    },
  { model: "Projeto",                 col: "foto1"       },
  { model: "Projeto",                 col: "foto2"       },
  { model: "Projeto",                 col: "foto3"       },
  { model: "Projeto",                 col: "foto4"       },
  { model: "Projeto",                 col: "foto5"       },
  { model: "Anais",                   col: "pdf_url"     },
  { model: "Anais",                   col: "cover_image_url" },
  { model: "Blog",                    col: "imageUrl"    },
  { model: "documentoTransparencia",  col: "arquivo_url" },
]

async function main() {
  console.log("🔄 Iniciando migração de URLs do Supabase...\n")
  let total = 0

  for (const { model, col } of TARGETS) {
    for (const domain of OLD_DOMAINS) {
      try {
        const result = await prisma.$executeRaw`
          UPDATE ${prisma.$raw(`"${model}"`)}
          SET ${prisma.$raw(`"${col}"`)} = REPLACE(${prisma.$raw(`"${col}"`)}, ${domain.old}, ${domain.new})
          WHERE ${prisma.$raw(`"${col}"`)} LIKE ${"%" + domain.old + "%"}
        `
        if (result > 0) {
          console.log(`  ✅  ${model}.${col}  →  ${result} linha(s) corrigida(s)`)
          total += result
        }
      } catch (e) {
        // coluna não existe nessa tabela — ignorar silenciosamente
      }
    }
  }

  console.log(`\n✔  Migração concluída. Total: ${total} registro(s) atualizado(s).`)
}

main()
  .catch((e) => {
    console.error("❌ Erro:", e.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
