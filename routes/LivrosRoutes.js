const express = require("express")
const router = express.Router()
const LivrosController = require("../controllers/LivrosController")
const { publicCache } = require("../middlewares/cacheControl")
const { authenticateAdmin } = require("../middlewares/authFunctions")
const { body } = require("express-validator")

const createValidation = [
  body("titulo").trim().notEmpty().withMessage("Título é obrigatório"),
  body("ano").isInt({ min: 1900 }).withMessage("Ano inválido"),
  body("autores").optional().isArray().withMessage("autores deve ser um array"),
]

// Rotas públicas
router.get("/published", publicCache(60), LivrosController.indexPublished)
router.get("/stats", publicCache(120), LivrosController.stats)
router.get("/:id", publicCache(60), LivrosController.show)

// Rotas administrativas — exigem admin autenticado.
router.get("/", authenticateAdmin, LivrosController.index)
router.post("/", authenticateAdmin, createValidation, LivrosController.store)
router.put("/:id", authenticateAdmin, LivrosController.update)
router.delete("/:id", authenticateAdmin, LivrosController.destroy)

module.exports = router
