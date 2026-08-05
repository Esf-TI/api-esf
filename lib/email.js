/**
 * Normaliza e-mail para armazenamento e comparação: remove espaços das pontas
 * e aplica minúsculas. E-mail é case-insensitive na prática, mas o Postgres
 * compara VarChar de forma case-sensitive — sem isso, um cadastro feito como
 * "Nucleo@Gmail.com" não conseguia logar digitando "nucleo@gmail.com".
 */
function normalizeEmail(email) {
  if (email == null) return email
  return String(email).trim().toLowerCase()
}

/**
 * Filtro Prisma para buscar e-mail ignorando maiúsculas/minúsculas.
 * Usado no login e na checagem de duplicidade, de modo que contas antigas
 * (gravadas com capitalização variada) continuem funcionando sem migração.
 */
function emailWhereInsensitive(email) {
  return { equals: normalizeEmail(email), mode: "insensitive" }
}

module.exports = { normalizeEmail, emailWhereInsensitive }
