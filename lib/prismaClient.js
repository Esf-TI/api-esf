require("dotenv").config()
const { PrismaClient } = require("@prisma/client")
const { PrismaPg } = require("@prisma/adapter-pg")
const { Pool } = require("pg")

const globalForPrisma = globalThis

if (!globalForPrisma.prisma) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Pool tunado para concorrência sob carga; configurável por env.
    max: Number(process.env.PG_POOL_MAX) || 20,
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS) || 30000,
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS) || 10000,
  })
  const adapter = new PrismaPg(pool)

  globalForPrisma.prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })
}

module.exports = globalForPrisma.prisma
