const express = require("express")
const router = express.Router()
const multer = require("multer")
const { authenticateAdmin } = require("../middlewares/authFunctions")
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
router.post("/", authenticateAdmin, upload.single("arquivo"), ResultadosController.criar)
router.put("/:id", authenticateAdmin, upload.single("arquivo"), ResultadosController.atualizar)
router.delete("/:id", authenticateAdmin, ResultadosController.deletar)

module.exports = router
