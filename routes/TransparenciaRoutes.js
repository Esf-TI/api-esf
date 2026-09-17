const express = require("express")
const router = express.Router()
const multer = require("multer")
const { authenticateAdmin, requireAdminRole } = require("../middlewares/authFunctions")

// Conteudo institucional: superadmin ou o admin de conteudo. O admin de
// materiais nao alcanca esta area.
const conteudo = requireAdminRole("conteudo")
const { publicCache } = require("../middlewares/cacheControl")
const TransparenciaController = require("../controllers/TransparenciaController")

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
})

// Rotas públicas (listagem para o site)
router.get("/", publicCache(60), TransparenciaController.listar)
router.get("/categorias", publicCache(120), TransparenciaController.listarCategorias)
router.get("/:id", publicCache(60), TransparenciaController.buscarPorId)

// Rotas protegidas (admin)
router.post("/", authenticateAdmin, conteudo, upload.array("arquivos", 20), TransparenciaController.criar)
router.put("/:id", authenticateAdmin, conteudo, upload.single("arquivo"), TransparenciaController.atualizar)
router.delete("/:id", authenticateAdmin, conteudo, TransparenciaController.deletar)

module.exports = router
