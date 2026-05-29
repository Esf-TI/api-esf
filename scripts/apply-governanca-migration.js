require("dotenv").config()
const fs = require("fs")
const path = require("path")
const { Client } = require("pg")

const connectionString =
  process.env.DIRECT_URL || process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL

if (!connectionString) {
  console.error("Defina DATABASE_URL ou DIRECT_URL no backend/.env")
  process.exit(1)
}

const sqlPath = path.join(
  __dirname,
  "../prisma/migrations/20260529000000_add_governanca_membros/migration.sql"
)
const sql = fs.readFileSync(sqlPath, "utf8")

async function main() {
  const client = new Client({ connectionString })
  try {
    await client.connect()
    console.log("Conectado ao Postgres. Aplicando migration governanca_membros...")
    await client.query(sql)
    const check = await client.query(
      "SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'governanca_membros'"
    )
    console.log("Tabela governanca_membros:", check.rows[0]?.n === 1 ? "OK" : "NÃO ENCONTRADA")
    process.exit(0)
  } catch (err) {
    console.error("Falha:", err.message)
    process.exit(1)
  } finally {
    await client.end().catch(() => {})
  }
}

main()
