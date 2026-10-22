const express = require("express")
const router = express.Router()
const { authenticateAtor } = require("../middlewares/authFunctions")
const AtividadesController = require("../controllers/AtividadesController")
const KanbanNacionalController = require("../controllers/KanbanNacionalController")

// Atividades internas do núcleo: o controller confere se o ator é do núcleo.
const atividades = express.Router()
atividades.get("/nucleo/:id", authenticateAtor, AtividadesController.listar)
atividades.post("/nucleo/:id", authenticateAtor, AtividadesController.criar)
atividades.patch("/:id", authenticateAtor, AtividadesController.atualizar)
atividades.delete("/:id", authenticateAtor, AtividadesController.excluir)

// Kanban Nacional: qualquer perfil logado. `/projetos` vem antes de `/:id`.
router.get("/projetos", authenticateAtor, KanbanNacionalController.projetosDosNucleos)
router.get("/", authenticateAtor, KanbanNacionalController.listar)
router.post("/", authenticateAtor, KanbanNacionalController.criar)
router.patch("/:id", authenticateAtor, KanbanNacionalController.atualizar)
router.delete("/:id", authenticateAtor, KanbanNacionalController.excluir)

module.exports = router
module.exports.atividades = atividades
