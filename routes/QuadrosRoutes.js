const express = require("express")
const router = express.Router()
const { authenticateAtor } = require("../middlewares/authFunctions")
const QuadrosController = require("../controllers/QuadrosController")

// Todo perfil logado entra; quem pode ver e editar cada quadro é decidido no controller.
router.get("/", authenticateAtor, QuadrosController.listar)
router.post("/", authenticateAtor, QuadrosController.criar)
router.get("/:id", authenticateAtor, QuadrosController.abrir)
router.put("/:id", authenticateAtor, QuadrosController.salvar)
router.patch("/:id", authenticateAtor, QuadrosController.renomear)
router.delete("/:id", authenticateAtor, QuadrosController.excluir)

router.post("/:id/bloqueio", authenticateAtor, QuadrosController.bloquear)
router.delete("/:id/bloqueio", authenticateAtor, QuadrosController.liberar)

router.get("/:id/versoes", authenticateAtor, QuadrosController.versoes)
router.post("/:id/versoes/:versao/restaurar", authenticateAtor, QuadrosController.restaurar)

module.exports = router
