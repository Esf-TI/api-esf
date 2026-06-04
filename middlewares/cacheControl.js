// Middleware de Cache-Control para respostas públicas (GET).
// Uso: router.get("/", publicCache(60), Controller.listar)
// maxAge em segundos. Aplica cache de borda/navegador e libera stale enquanto revalida.
function publicCache(maxAgeSeconds = 60) {
  const sMaxAge = maxAgeSeconds
  const staleWhileRevalidate = Math.max(maxAgeSeconds, 30)
  return (req, res, next) => {
    // Só faz sentido cachear requisições idempotentes.
    if (req.method === "GET") {
      res.set(
        "Cache-Control",
        `public, max-age=${maxAgeSeconds}, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`
      )
    }
    next()
  }
}

module.exports = { publicCache }
