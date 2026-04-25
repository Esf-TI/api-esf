require("dotenv").config()
const { Pool } = require("pg")
const { PrismaPg } = require("@prisma/adapter-pg")
const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcrypt")

const DEFAULT_ADMIN_EMAIL = "admin@esf.org.br"
const DEFAULT_ADMIN_PASSWORD = "Admin@123"
const BOOTSTRAP_RETRY_ATTEMPTS = Number(process.env.BOOTSTRAP_RETRY_ATTEMPTS || 6)
const BOOTSTRAP_RETRY_DELAY_MS = Number(process.env.BOOTSTRAP_RETRY_DELAY_MS || 2000)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const isTransientNetworkError = (error) => {
  const message = String(error?.message || "")
  return (
    error?.code === "EAI_AGAIN" ||
    error?.code === "ENOTFOUND" ||
    error?.code === "ECONNREFUSED" ||
    message.includes("EAI_AGAIN") ||
    message.includes("ENOTFOUND") ||
    message.includes("ECONNREFUSED")
  )
}

/**
 * Garante um admin padrão se ainda não existir (idempotente).
 * Usado no boot da API e pelo script `yarn seed`.
 */
async function ensureDefaultAdmin() {
  if (!process.env.DATABASE_URL) {
    console.warn("[bootstrap] DATABASE_URL ausente — pulando criação do admin padrão.")
    return
  }

  let attempt = 1
  while (attempt <= BOOTSTRAP_RETRY_ATTEMPTS) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const adapter = new PrismaPg(pool)
    const prisma = new PrismaClient({ adapter })

    try {
      const existing = await prisma.admin.findUnique({ where: { email: DEFAULT_ADMIN_EMAIL } })

      if (existing) {
        console.log("[bootstrap] Admin já existe:", existing.email)
        return
      }

      const hash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12)
      const admin = await prisma.admin.create({
        data: {
          nome: "Administrador ESF",
          email: DEFAULT_ADMIN_EMAIL,
          senha: hash,
          role: "super_admin",
          status: "active",
        },
      })

      console.log("[bootstrap] Admin padrão criado — email:", admin.email, "| troque a senha em produção.")
      return
    } catch (error) {
      const lastAttempt = attempt === BOOTSTRAP_RETRY_ATTEMPTS
      if (!isTransientNetworkError(error) || lastAttempt) {
        throw error
      }

      console.warn(
        `[bootstrap] Banco indisponível (${error.code || "erro"}). Tentativa ${attempt}/${BOOTSTRAP_RETRY_ATTEMPTS}; nova tentativa em ${BOOTSTRAP_RETRY_DELAY_MS}ms...`,
      )
      await sleep(BOOTSTRAP_RETRY_DELAY_MS)
      attempt += 1
    } finally {
      await prisma.$disconnect()
      await pool.end()
    }
  }
}

if (require.main === module) {
  ensureDefaultAdmin().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

module.exports = { ensureDefaultAdmin, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD }
