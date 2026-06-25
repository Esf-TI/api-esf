require("dotenv").config()
const { Pool } = require("pg")
const { PrismaPg } = require("@prisma/adapter-pg")
const { PrismaClient } = require("@prisma/client")

// Mapeamento: valor antigo -> valor novo
const RENOMEACOES = [
  { de: "Conselho de Administração", para: "Coordenação" },
  // Descomente a linha abaixo se quiser mover "Diretoria Executiva" para "Conselho de Diretores"
  // { de: "Diretoria Executiva", para: "Conselho de Diretores" },
]

async function renomearConselhos() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL ausente no .env")
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    for (const { de, para } of RENOMEACOES) {
      const count = await prisma.governancaMembro.count({ where: { conselho: de } })

      if (count === 0) {
        console.log(`[seed-governanca] Nenhum membro com conselho "${de}" — pulando.`)
        continue
      }

      await prisma.governancaMembro.updateMany({
        where: { conselho: de },
        data: { conselho: para },
      })

      console.log(`[seed-governanca] ${count} membro(s) atualizados: "${de}" -> "${para}"`)
    }

    // Exibe o estado final por conselho
    const grupos = await prisma.governancaMembro.groupBy({
      by: ["conselho"],
      _count: { id: true },
      orderBy: { conselho: "asc" },
    })

    console.log("\n[seed-governanca] Estado atual dos conselhos:")
    grupos.forEach(({ conselho, _count }) => {
      console.log(`  ${conselho}: ${_count.id} membro(s)`)
    })

    console.log("\n[seed-governanca] Concluído.")
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

if (require.main === module) {
  renomearConselhos().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

module.exports = { renomearConselhos }
