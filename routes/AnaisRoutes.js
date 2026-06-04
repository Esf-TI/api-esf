const express = require("express")
const router = express.Router()
const AnaisController = require("../controllers/AnaisController")
const { publicCache } = require("../middlewares/cacheControl")
const { body } = require("express-validator")

// Validações para criação de anais
const createValidation = [
  body("title").trim().notEmpty().withMessage("Título é obrigatório"),
  body("authors").isArray({ min: 1 }).withMessage("Autores deve ser um array com pelo menos 1 autor"),
  body("category").trim().notEmpty().withMessage("Categoria é obrigatória"),
  body("year").isInt({ min: 2000 }).withMessage("Ano inválido"),
  body("pdf_url").trim().notEmpty().withMessage("URL do arquivo é obrigatória"),
]

// Rotas públicas
router.get("/published", publicCache(60), AnaisController.indexPublished) // NOVA ROTA: Apenas publicadas
router.get("/", AnaisController.index) // Admin: todas as publicações
router.get("/stats", publicCache(120), AnaisController.stats)
router.get("/:id", publicCache(60), AnaisController.show)

// Rotas administrativas (adicionar middleware de autenticação aqui)
router.post("/", createValidation, AnaisController.store)
router.put("/:id", AnaisController.update)
router.delete("/:id", AnaisController.destroy)

module.exports = router
