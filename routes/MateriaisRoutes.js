const express = require("express")
const router = express.Router()
const multer = require("multer")
const {
  authenticateAdmin,
  authenticateOpcional,
  requireAdminRole,
} = require("../middlewares/authFunctions")
const { publicCache } = require("../middlewares/cacheControl")
const MateriaisController = require("../controllers/MateriaisController")

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
})

// Leitura: `authenticateOpcional` não barra ninguém — quem está logado recebe o
// acervo inteiro, visitante recebe só o que foi marcado como público. O filtro
// mora no controller, não aqui.
router.get("/", authenticateOpcional, publicCache(60), MateriaisController.listar)
router.get("/categorias", authenticateOpcional, publicCache(120), MateriaisController.listarCategorias)
router.get("/:id", authenticateOpcional, publicCache(60), MateriaisController.buscarPorId)

// Escrita: admin com papel `materiais` (ou superadmin). É este usuário de acesso
// limitado que a reunião de 10/09/2026 pediu — ele não alcança núcleos,
// transparência nem governança.
const podeManterMateriais = [authenticateAdmin, requireAdminRole("materiais")]

router.post("/", ...podeManterMateriais, upload.array("arquivos", 20), MateriaisController.criar)
router.put("/:id", ...podeManterMateriais, upload.single("arquivo"), MateriaisController.atualizar)
router.delete("/:id", ...podeManterMateriais, MateriaisController.deletar)

module.exports = router
