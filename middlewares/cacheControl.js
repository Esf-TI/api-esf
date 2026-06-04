// Middleware de Cache-Control para respostas públicas (GET).
// Uso: router.get("/", publicCache(60), Controller.listar)
//
// IMPORTANTE: usamos "no-cache" (revalidação), NÃO "max-age".
// Vários desses endpoints são lidos também pelos painéis admin logo após
// criar/editar/excluir. Com "max-age" o navegador devolvia a lista CACHEADA
// (dados velhos) e a alteração parecia não ter funcionado.
//
// "no-cache" permite o navegador/borda ARMAZENAR a resposta, mas obriga a
// REVALIDAR com o servidor a cada uso. Combinado ao ETag automático do Express,
// isso retorna 304 (sem corpo, barato) quando nada mudou e dados frescos
// imediatamente após uma alteração. Eficiência + correção.
function publicCache(_maxAgeSeconds = 60) {
  // Parâmetro mantido por compatibilidade de assinatura nas rotas.
  void _maxAgeSeconds
  return (req, res, next) => {
    if (req.method === "GET") {
      res.set("Cache-Control", "public, no-cache")
    }
    next()
  }
}

module.exports = { publicCache }
