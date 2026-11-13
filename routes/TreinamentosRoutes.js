const express = require("express")
const multer = require("multer")
const router = express.Router()
const { authenticateAtor } = require("../middlewares/authFunctions")
const TreinamentosController = require("../controllers/TreinamentosController")

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
})

// Todas exigem login; o controller decide quem vê (publicado, visibilidade) e quem gerencia.
// Os caminhos fixos vêm antes de `/:id` para não serem lidos como um id.

// Pedidos de novos treinamentos
router.post("/pedidos", authenticateAtor, TreinamentosController.criarPedido)
router.get("/pedidos/meus", authenticateAtor, TreinamentosController.meusPedidos)
router.get("/pedidos", authenticateAtor, TreinamentosController.listarPedidos)
router.patch("/pedidos/:id", authenticateAtor, TreinamentosController.responderPedido)

// Aulas e anexos
router.post("/aulas/:id/concluir", authenticateAtor, TreinamentosController.concluir)
router.delete("/aulas/:id/concluir", authenticateAtor, TreinamentosController.desmarcar)
router.put("/aulas/:id", authenticateAtor, TreinamentosController.atualizarAula)
router.delete("/aulas/:id", authenticateAtor, TreinamentosController.excluirAula)
router.post("/aulas/:id/anexos", authenticateAtor, upload.array("arquivos", 10), TreinamentosController.enviarAnexos)
router.patch("/anexos/:id", authenticateAtor, TreinamentosController.renomearAnexo)
router.delete("/anexos/:id", authenticateAtor, TreinamentosController.excluirAnexo)

// Treinamentos
router.get("/", authenticateAtor, TreinamentosController.listar)
router.post("/", authenticateAtor, TreinamentosController.criar)
router.get("/:id", authenticateAtor, TreinamentosController.obter)
router.put("/:id", authenticateAtor, TreinamentosController.atualizar)
router.delete("/:id", authenticateAtor, TreinamentosController.excluir)
router.patch("/:id/publicar", authenticateAtor, TreinamentosController.publicar)
router.post("/:id/aulas", authenticateAtor, TreinamentosController.criarAula)
router.patch("/:id/aulas/ordem", authenticateAtor, TreinamentosController.ordenarAulas)

module.exports = router
