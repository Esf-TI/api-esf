/**
 * Papéis de administrador.
 *
 * O campo `Admin.role` existia desde o início e era devolvido no login, mas
 * nenhuma rota o consultava: na prática todo admin era superadmin e podia
 * apagar núcleo, transparência e governança. Este módulo é a fonte única do
 * vocabulário; quem aplica é `requireAdminRole` em `middlewares/authFunctions`.
 */

/** `admin` é o valor legado: todas as contas criadas antes desta mudança o têm. */
const SUPERADMIN = "superadmin"
const LEGADO_SUPERADMIN = "admin"

const PAPEIS = {
  [SUPERADMIN]: "Acesso total ao sistema",
  conteudo: "Conteúdo institucional: blog, publicações, livros, transparência e governança",
  materiais: "Somente o acervo de materiais dos núcleos",
}

/** Valores aceitos ao criar ou editar uma conta de admin. */
const PAPEIS_VALIDOS = Object.keys(PAPEIS)

/**
 * Normaliza o papel gravado no banco. Contas antigas têm `admin`, que sempre
 * significou acesso total — tratá-las como papel desconhecido trancaria a
 * organização inteira para fora no primeiro deploy.
 */
function normalizarPapel(role) {
  const valor = String(role || "").trim().toLowerCase()
  if (!valor || valor === LEGADO_SUPERADMIN) return SUPERADMIN
  return PAPEIS_VALIDOS.includes(valor) ? valor : SUPERADMIN
}

/** Superadmin passa em qualquer verificação; os demais só no que foi listado. */
function papelAtende(role, permitidos) {
  const papel = normalizarPapel(role)
  if (papel === SUPERADMIN) return true
  return permitidos.map((p) => normalizarPapel(p)).includes(papel)
}

module.exports = { PAPEIS, PAPEIS_VALIDOS, SUPERADMIN, normalizarPapel, papelAtende }
