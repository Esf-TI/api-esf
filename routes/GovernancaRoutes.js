const express = require("express")
const router = express.Router()
const multer = require("multer")
const { authenticateAdmin } = require("../middlewares/authFunctions")
const GovernancaController = require("../controllers/GovernancaController")

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB para fotos
})

// Rotas públicas
router.get("/", GovernancaController.listar)

// Rotas protegidas (admin)
router.get("/admin/todos", authenticateAdmin, GovernancaController.listarTodos)
router.post("/", authenticateAdmin, upload.single("foto"), GovernancaController.criar)
router.put("/:id", authenticateAdmin, upload.single("foto"), GovernancaController.atualizar)
router.delete("/:id", authenticateAdmin, GovernancaController.deletar)

module.exports = router
