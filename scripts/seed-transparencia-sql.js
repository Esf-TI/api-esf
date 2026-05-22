require("dotenv").config()

const PLACEHOLDER_URL =
  "https://storage.esf.org.br/storage/v1/object/public/transparencia/placeholders/em-breve.pdf"

const CARDS = [
  [
    "Estatuto",
    "Aqui vocÃª encontrarÃ¡ informaÃ§Ãµes detalhadas sobre as regras e regulamentos que regem nossa organizaÃ§Ã£o.",
    "Documentos Institucionais",
  ],
  [
    "GovernanÃ§a",
    "Entenda sobre a nossa governanÃ§a e sua importÃ¢ncia em nossa organizaÃ§Ã£o.",
    "GovernanÃ§a",
  ],
  [
    "Documentos ContÃ¡beis",
    "Clique aqui para explorar nossos relatÃ³rios financeiros, demonstraÃ§Ãµes de resultados e balanÃ§os patrimoniais.",
    "PrestaÃ§Ã£o de Contas",
  ],
  [
    "Auditorias Financeiras",
    "Explore nossa seÃ§Ã£o de Auditoria Financeira para obter uma anÃ¡lise detalhada e transparente das nossas finanÃ§as.",
    "Auditoria",
  ],
]

async function pgQuery(query) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const base = (process.env.SUPABASE_URL || "").replace(/\/$/, "")
  const res = await fetch(`${base}/pg/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

function esc(s) {
  return String(s).replace(/'/g, "''")
}

async function main() {
  for (const [titulo, descricao, categoria] of CARDS) {
    const sql = `
INSERT INTO "documentos_transparencia" ("titulo", "descricao", "categoria", "arquivo_url", "arquivo_nome", "arquivo_tamanho", "updated_at")
SELECT '${esc(titulo)}', '${esc(descricao)}', '${esc(categoria)}', '${PLACEHOLDER_URL}', 'em-breve.pdf', 178, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "documentos_transparencia" WHERE "titulo" = '${esc(titulo)}');`
    await pgQuery(sql)
    console.log("OK:", titulo)
  }

  const rows = await pgQuery(
    'SELECT id, titulo, categoria FROM "documentos_transparencia" ORDER BY id;',
  )
  console.log("Registros:", JSON.stringify(rows, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

