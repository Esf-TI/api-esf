const express = require("express")
const router = express.Router()
const LivrosController = require("../controllers/LivrosController")
const { publicCache } = require("../middlewares/cacheControl")
const { authenticateAdmin, requireAdminRole } = require("../middlewares/authFunctions")

// Conteudo institucional: superadmin ou o admin de conteudo. O admin de
// materiais nao alcanca esta area.
const conteudo = requireAdminRole("conteudo")
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
router.get("/", authenticateAdmin, conteudo, LivrosController.index)
router.post("/", authenticateAdmin, conteudo, createValidation, LivrosController.store)
router.put("/:id", authenticateAdmin, conteudo, LivrosController.update)
router.delete("/:id", authenticateAdmin, conteudo, LivrosController.destroy)

module.exports = router
