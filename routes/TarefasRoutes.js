const express = require("express")
const router = express.Router()
const TarefasControllers = require("../controllers/TarefasControllers")
const {
  authenticateAdminOrNucleo,
  ensureProjetoDoNucleo,
  ensureTarefaDoNucleo,
} = require("../middlewares/authFunctions")

// Aqui o :id e do PROJETO — o guard confere se ele pertence ao nucleo do token.
router.get("/projeto/:id", authenticateAdminOrNucleo, ensureProjetoDoNucleo, TarefasControllers.listarDoProjeto)
router.post("/projeto/:id", authenticateAdminOrNucleo, ensureProjetoDoNucleo, TarefasControllers.criar)

// Aqui o :id e da TAREFA; o guard resolve tarefa -> projeto -> nucleo.
router.patch("/:id", authenticateAdminOrNucleo, ensureTarefaDoNucleo, TarefasControllers.atualizar)
router.delete("/:id", authenticateAdminOrNucleo, ensureTarefaDoNucleo, TarefasControllers.excluir)

module.exports = router
