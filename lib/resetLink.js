/**
 * Geracao do link de definicao de senha, compartilhado entre a recuperacao de
 * senha (admin/nucleo/membro) e o convite de novo membro.
 *
 * O segredo do token e derivado do hash de senha ATUAL da conta: quando a senha
 * muda, o hash muda e qualquer token emitido antes deixa de valer. Isso da
 * efeito de uso unico sem precisar de tabela nem coluna extra no banco.
 */

const jwt = require("jsonwebtoken")
require("dotenv").config()

const BASE_SECRET = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || "esf-fallback-secret"
const FRONTEND_URL = String(process.env.FRONTEND_URL || "https://esf.org.br").replace(/\/+$/, "")

/** Conta ainda sem senha (membro recem-convidado): valor estavel para derivar o segredo. */
const SEM_SENHA = "convite-pendente"

function deriveSecret(entityType, passwordHash) {
  return `${BASE_SECRET}:${entityType}:${passwordHash || SEM_SENHA}`
}

/**
 * @param {object} p
 * @param {string} p.type  admin | nucleo | membro
 * @param {number} p.id
 * @param {string|null} p.hash  hash atual da senha (null em convite pendente)
 * @param {string} [p.ttl]  padrao 1h; convite usa prazo maior
 */
function gerarTokenSenha({ type, id, hash, ttl = "1h" }) {
  return jwt.sign({ id, type }, deriveSecret(type, hash), { expiresIn: ttl })
}

function linkDefinicaoSenha(token) {
  return `${FRONTEND_URL}/redefinir-senha?token=${encodeURIComponent(token)}`
}

module.exports = { deriveSecret, gerarTokenSenha, linkDefinicaoSenha, FRONTEND_URL, SEM_SENHA }
