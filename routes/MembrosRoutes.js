const express = require("express")
const router = express.Router()
const MembrosControllers = require("../controllers/MembrosControllers")
const {
  authenticateAdminOrNucleo,
  authenticateMembro,
  ensureNucleoSelf,
  ensureMembroDoNucleo,
} = require("../middlewares/authFunctions")

// ---- Sessao do membro (rotas publicas) ----
router.post("/login", MembrosControllers.login)
router.post("/auth/refresh", MembrosControllers.refreshMembroToken)

// ---- Area do proprio membro ----
router.get("/me", authenticateMembro, MembrosControllers.meuPerfil)
router.patch("/me", authenticateMembro, MembrosControllers.atualizarMeuPerfil)

// ---- Gestao da equipe pelo nucleo (ou admin) ----
// `ensureNucleoSelf` compara req.params.id com o nucleo do token: sem ele, um
// nucleo logado listaria e cadastraria membros em qualquer outro nucleo.
router.get("/nucleo/:id", authenticateAdminOrNucleo, ensureNucleoSelf, MembrosControllers.listarDoNucleo)
router.post("/nucleo/:id", authenticateAdminOrNucleo, ensureNucleoSelf, MembrosControllers.criar)

// Aqui o :id e do MEMBRO, entao o guard checa a posse pelo vinculo dele.
router.patch("/:id", authenticateAdminOrNucleo, ensureMembroDoNucleo, MembrosControllers.atualizar)
router.delete("/:id", authenticateAdminOrNucleo, ensureMembroDoNucleo, MembrosControllers.desligar)
router.post("/:id/convite", authenticateAdminOrNucleo, ensureMembroDoNucleo, MembrosControllers.reenviarConvite)

module.exports = router
