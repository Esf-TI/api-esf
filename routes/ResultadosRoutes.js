const express = require("express")
const router = express.Router()
const multer = require("multer")
const { authenticateAdmin, requireAdminRole } = require("../middlewares/authFunctions")

// Conteudo institucional: superadmin ou o admin de conteudo. O admin de
// materiais nao alcanca esta area.
const conteudo = requireAdminRole("conteudo")
const { publicCache } = require("../middlewares/cacheControl")
const ResultadosController = require("../controllers/ResultadosController")

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true)
  } else {
    cb(new Error("Apenas arquivos PDF são permitidos"), false)
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 },
})

// Rotas públicas
router.get("/", publicCache(60), ResultadosController.listar)
router.get("/:id", publicCache(60), ResultadosController.buscarPorId)

// Rotas administrativas
router.post("/", authenticateAdmin, conteudo, upload.single("arquivo"), ResultadosController.criar)
router.put("/:id", authenticateAdmin, conteudo, upload.single("arquivo"), ResultadosController.atualizar)
router.delete("/:id", authenticateAdmin, conteudo, ResultadosController.deletar)

module.exports = router
