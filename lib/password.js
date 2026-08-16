/**
 * Regra única de senha do sistema (núcleos e administradores).
 *
 * Mantida aqui para que cadastro, criação pelo admin e redefinição de senha
 * usem exatamente o mesmo critério — antes cada ponto validava por conta
 * própria e bastava 8 caracteres.
 */
const SENHA_MIN = 10

/** Texto exibido ao usuário; deve ser idêntico ao do frontend. */
const REGRA_SENHA = `A senha deve ter pelo menos ${SENHA_MIN} caracteres, incluindo um número e um caractere especial`

/**
 * Valida a senha. Devolve uma lista de problemas (vazia quando está tudo certo),
 * para o chamador montar a resposta como preferir.
 */
function validarSenha(senha) {
  const erros = []
  const valor = senha == null ? "" : String(senha)

  if (valor.length < SENHA_MIN) {
    erros.push(`A senha deve ter pelo menos ${SENHA_MIN} caracteres`)
  }
  if (!/[0-9]/.test(valor)) {
    erros.push("A senha deve conter pelo menos um número")
  }
  if (!/[^A-Za-z0-9]/.test(valor)) {
    erros.push("A senha deve conter pelo menos um caractere especial (ex.: ! @ # $ %)")
  }

  return erros
}

/** true quando a senha atende a todos os critérios. */
function senhaValida(senha) {
  return validarSenha(senha).length === 0
}

module.exports = { validarSenha, senhaValida, SENHA_MIN, REGRA_SENHA }
