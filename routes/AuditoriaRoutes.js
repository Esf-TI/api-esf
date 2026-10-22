const express = require("express")
const router = express.Router()
const { authenticateAtor } = require("../middlewares/authFunctions")
const AuditoriaController = require("../controllers/AuditoriaController")

// As duas consultas decidem a permissão no controller, porque o mesmo token
// pode ser de admin, núcleo ou membro e cada um enxerga um recorte diferente.
router.get("/", authenticateAtor, AuditoriaController.geral)
router.get("/nucleo/:id", authenticateAtor, AuditoriaController.doNucleo)

module.exports = router
