const express = require("express")
const router = express.Router()
const adminController = require("../controllers/AdminController")
const nucleosController = require("../controllers/NucleosControllers")
const { authenticateAdmin } = require("../middlewares/authFunctions")
const prisma = require("../lib/prismaClient")

router.post("/", adminController.create)
router.post("/auth/refresh", adminController.updateToken)
router.post("/login", adminController.login)

router.get("/dashboard/stats", authenticateAdmin, adminController.getDashboardStats)
router.get("/activity-logs", authenticateAdmin, adminController.getActivityLogs)

router.get("/profile", authenticateAdmin, async (req, res) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: { id: true, email: true, nome: true, role: true, status: true },
    })

    if (!admin) return res.status(404).json({ success: false, message: "Admin não encontrado" })

    res.json({ success: true, data: { id: admin.id, email: admin.email, name: admin.nome, role: admin.role } })
  } catch (error) {
    res.status(500).json({ success: false, message: "Erro ao buscar perfil" })
  }
})

router.get("/nucleos", authenticateAdmin, nucleosController.GetAllNucleos)
router.get("/nucleos/:id", authenticateAdmin, nucleosController.GetNucleoById)
router.patch("/nucleos/:id/status", authenticateAdmin, adminController.updateNucleoStatus)
router.post("/nucleos", authenticateAdmin, nucleosController.CreateNucleoByAdmin)
router.put("/nucleos/:id", authenticateAdmin, nucleosController.putNucleoWithoutFile)

module.exports = router
