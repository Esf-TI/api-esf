/**
 * Converte "YYYY-MM-DD" em Date no fuso LOCAL.
 *
 * `new Date("2026-08-06")` é interpretado como meia-noite UTC; em UTC-3 isso
 * representa o dia 05 às 21h local, e um `setHours(0,0,0,0)` posterior recuava
 * a data em um dia. Isso fazia a checagem "não pode ser no futuro" aceitar
 * a data de amanhã e gravava datas de fundação com um dia a menos.
 *
 * Devolve `null` quando o valor é vazio ou não é uma data válida (ex.: o
 * usuário digitou 31/12/2020), para o chamador responder 400 em vez de
 * estourar um 500 genérico no Prisma com Invalid Date.
 */
function parseDataLocal(valor) {
  if (valor == null || valor === "") return null

  const texto = String(valor).trim()

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    const [, ano, mes, dia] = iso
    const d = new Date(Number(ano), Number(mes) - 1, Number(dia))
    return Number.isNaN(d.getTime()) ? null : d
  }

  const d = new Date(texto)
  return Number.isNaN(d.getTime()) ? null : d
}

/** true se a data for posterior a hoje (comparando só o dia, no fuso local). */
function isDataFutura(data) {
  if (!data) return false
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const alvo = new Date(data)
  alvo.setHours(0, 0, 0, 0)
  return alvo > hoje
}

module.exports = { parseDataLocal, isDataFutura }
