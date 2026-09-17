const express = require("express")
const router = express.Router()
const multer = require("multer")
const { authenticateAdmin, requireAdminRole } = require("../middlewares/authFunctions")

// Conteudo institucional: superadmin ou o admin de conteudo. O admin de
// materiais nao alcanca esta area.
const conteudo = requireAdminRole("conteudo")
const { publicCache } = require("../middlewares/cacheControl")
const GovernancaController = require("../controllers/GovernancaController")

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
})

router.get("/", publicCache(120), GovernancaController.listarPublico)
router.get("/admin/todos", authenticateAdmin, conteudo, GovernancaController.listarTodos)
router.post("/", authenticateAdmin, conteudo, upload.single("foto"), GovernancaController.criar)
router.put("/:id", authenticateAdmin, conteudo, upload.single("foto"), GovernancaController.atualizar)
router.delete("/:id", authenticateAdmin, conteudo, GovernancaController.deletar)

module.exports = router
