const express = require("express")
const router = express.Router()
const { authenticateAdmin, requireAdminRole } = require("../middlewares/authFunctions")
const { publicCache } = require("../middlewares/cacheControl")
const NucleoMapaController = require("../controllers/NucleoMapaController")

// Conteúdo institucional: superadmin ou o admin de conteúdo.
const conteudo = requireAdminRole("conteudo")

router.get("/", publicCache(60), NucleoMapaController.listar)
router.post("/", authenticateAdmin, conteudo, NucleoMapaController.criar)
router.put("/:id", authenticateAdmin, conteudo, NucleoMapaController.atualizar)
router.delete("/:id", authenticateAdmin, conteudo, NucleoMapaController.deletar)

module.exports = router
