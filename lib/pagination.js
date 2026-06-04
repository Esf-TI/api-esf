// Helper de paginação retrocompatível.
// Lê ?page= e ?limit= da query. Quando "limit" não é informado, retorna { enabled:false }
// e o controller mantém o comportamento atual (sem take/skip), preservando contratos antigos.
// Quando informado, devolve { enabled:true, take, skip, page, limit } para uso no Prisma.
const MAX_LIMIT = 100

function getPagination(query = {}) {
  const rawLimit = query.limit ?? query.perPage
  if (rawLimit === undefined || rawLimit === null || rawLimit === "") {
    return { enabled: false }
  }
  let limit = Number.parseInt(String(rawLimit), 10)
  if (!Number.isFinite(limit) || limit <= 0) limit = 20
  if (limit > MAX_LIMIT) limit = MAX_LIMIT

  let page = Number.parseInt(String(query.page ?? "1"), 10)
  if (!Number.isFinite(page) || page <= 0) page = 1

  return { enabled: true, take: limit, skip: (page - 1) * limit, page, limit }
}

function buildMeta(total, pag) {
  if (!pag.enabled) return undefined
  return {
    total,
    page: pag.page,
    limit: pag.limit,
    totalPages: Math.ceil(total / pag.limit) || 1,
  }
}

module.exports = { getPagination, buildMeta, MAX_LIMIT }
