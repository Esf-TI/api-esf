const express = require("express")
const router = express.Router()
const multer = require("multer")
const { authenticateAdmin } = require("../middlewares/authFunctions")
const TransparenciaController = require("../controllers/TransparenciaController")

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
})

// Rotas públicas (listagem para o site)
router.get("/", TransparenciaController.listar)
router.get("/categorias", TransparenciaController.listarCategorias)
router.get("/:id", TransparenciaController.buscarPorId)

// Rotas protegidas (admin)
router.post("/", authenticateAdmin, upload.array("arquivos", 20), TransparenciaController.criar)
router.put("/:id", authenticateAdmin, upload.single("arquivo"), TransparenciaController.atualizar)
router.delete("/:id", authenticateAdmin, TransparenciaController.deletar)

module.exports = router
