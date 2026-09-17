const express = require("express")
const router = express.Router()
const adminController = require("../controllers/AdminController")
const nucleosController = require("../controllers/NucleosControllers")
const adminUsuarios = require("../controllers/AdminUsuariosController")
const { authenticateAdmin, requireAdminRole } = require("../middlewares/authFunctions")
const { PAPEIS, PAPEIS_VALIDOS, normalizarPapel } = require("../lib/adminRoles")
const prisma = require("../lib/prismaClient")

// Contas, nucleos e o painel administrativo sao exclusivos do superadmin: os
// papeis `conteudo` e `materiais` existem justamente para NAO alcancar isto.
const superadmin = requireAdminRole()

// Criação de administrador: só um admin já autenticado pode criar outro.
// (O admin inicial é criado pelo bootstrap `ensureDefaultAdmin`, não por esta rota.)
router.post("/", authenticateAdmin, superadmin, adminController.create)
router.post("/auth/refresh", adminController.updateToken)
router.post("/login", adminController.login)

router.get("/dashboard/stats", authenticateAdmin, superadmin, adminController.getDashboardStats)
router.get("/activity-logs", authenticateAdmin, superadmin, adminController.getActivityLogs)

// Perfil proprio: qualquer admin precisa ler o seu, inclusive o de materiais —
// e dele que o front tira o papel para montar o menu.
router.get("/profile", authenticateAdmin, async (req, res) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: { id: true, email: true, nome: true, role: true, status: true },
    })

    if (!admin) return res.status(404).json({ success: false, message: "Admin não encontrado" })

    res.json({ success: true, data: { id: admin.id, email: admin.email, name: admin.nome, role: normalizarPapel(admin.role) } })
  } catch (error) {
    res.status(500).json({ success: false, message: "Erro ao buscar perfil" })
  }
})

// Vocabulario de papeis, para a tela de contas montar o seletor sem repetir a
// lista no front.
router.get("/papeis", authenticateAdmin, superadmin, (req, res) => {
  res.json({
    success: true,
    data: PAPEIS_VALIDOS.map((valor) => ({ valor, descricao: PAPEIS[valor] })),
  })
})

// Contas do sistema (admins, nucleos e membros) em uma visao so
router.get("/usuarios", authenticateAdmin, superadmin, adminUsuarios.listar)
router.get("/usuarios/:tipo/:id", authenticateAdmin, superadmin, adminUsuarios.detalhe)
router.post("/usuarios/:tipo/:id/reset-senha", authenticateAdmin, superadmin, adminUsuarios.enviarResetSenha)
router.patch("/usuarios/:tipo/:id/status", authenticateAdmin, superadmin, adminUsuarios.alterarStatus)
router.delete("/usuarios/:tipo/:id", authenticateAdmin, superadmin, adminUsuarios.excluir)

router.get("/nucleos", authenticateAdmin, superadmin, nucleosController.GetAllNucleos)
router.get("/nucleos/:id", authenticateAdmin, superadmin, nucleosController.GetNucleoById)
router.patch("/nucleos/:id/status", authenticateAdmin, superadmin, adminController.updateNucleoStatus)
router.post("/nucleos", authenticateAdmin, superadmin, nucleosController.CreateNucleoByAdmin)
router.put("/nucleos/:id", authenticateAdmin, superadmin, nucleosController.putNucleoWithoutFile)

module.exports = router
