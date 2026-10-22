const express = require("express")
const router = express.Router()
const TarefasControllers = require("../controllers/TarefasControllers")
const {
  authenticateAtor,
  ensureProjetoDoNucleo,
  ensureTarefaDoNucleo,
} = require("../middlewares/authFunctions")

// Aqui o :id e do PROJETO — o guard confere se ele pertence ao nucleo do token.
router.get("/projeto/:id", authenticateAtor, ensureProjetoDoNucleo, TarefasControllers.listarDoProjeto)
router.post("/projeto/:id", authenticateAtor, ensureProjetoDoNucleo, TarefasControllers.criar)

// Aqui o :id e da TAREFA; o guard resolve tarefa -> projeto -> nucleo.
router.patch("/:id", authenticateAtor, ensureTarefaDoNucleo, TarefasControllers.atualizar)
router.delete("/:id", authenticateAtor, ensureTarefaDoNucleo, TarefasControllers.excluir)

module.exports = router
