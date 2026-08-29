require("dotenv").config()
const { Pool } = require("pg")
const { PrismaPg } = require("@prisma/adapter-pg")
const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcrypt")

const crypto = require("crypto")

const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@esf.org.br"

/**
 * Gera uma senha forte aleatoria para o admin inicial.
 *
 * Havia aqui uma senha fixa no codigo. Como o repositorio e
 * publico, qualquer pessoa que o abrisse tinha a credencial do super_admin de
 * producao — e a conta seguia com ela desde abril de 2026. Agora: usa
 * ADMIN_PASSWORD se estiver definida no ambiente; senao sorteia uma e imprime
 * UMA vez no log do primeiro boot, para o responsavel trocar em seguida.
 */
function gerarSenhaInicial() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
  const simbolos = "!@#$%&*?"
  const sorteia = (fonte, n) =>
    Array.from({ length: n }, () => fonte[crypto.randomInt(fonte.length)]).join("")
  // Atende a regra do sistema: 10+ caracteres, com numero e caractere especial.
  return sorteia(alfabeto, 14) + sorteia("23456789", 1) + sorteia(simbolos, 1)
}
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

      const senhaInicial = process.env.ADMIN_PASSWORD || gerarSenhaInicial()
      const veioDoAmbiente = Boolean(process.env.ADMIN_PASSWORD)
      const hash = await bcrypt.hash(senhaInicial, 12)
      const admin = await prisma.admin.create({
        data: {
          nome: "Administrador ESF",
          email: DEFAULT_ADMIN_EMAIL,
          senha: hash,
          role: "super_admin",
          status: "active",
        },
      })

      if (veioDoAmbiente) {
        console.log("[bootstrap] Admin criado com a senha de ADMIN_PASSWORD — email:", admin.email)
      } else {
        // Unica vez que a senha aparece: nao fica gravada em lugar nenhum.
        console.log("[bootstrap] Admin criado — email:", admin.email)
        console.log("[bootstrap] SENHA INICIAL (anote agora, nao sera exibida de novo):", senhaInicial)
        console.log("[bootstrap] Troque a senha no primeiro acesso.")
      }
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

module.exports = { ensureDefaultAdmin, DEFAULT_ADMIN_EMAIL }
