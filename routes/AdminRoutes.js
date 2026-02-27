const express = require("express")
const router = express.Router()
const adminController = require("../controllers/AdminController")
const nucleosController = require("../controllers/NucleosControllers")
const { authenticateAdmin } = require("../middlewares/authFunctions")

router.post("/", adminController.create)
router.post("/auth/refresh", adminController.updateToken)
router.post("/login", adminController.login)

router.get("/dashboard/stats", authenticateAdmin, adminController.getDashboardStats)
router.get("/activity-logs", authenticateAdmin, adminController.getActivityLogs)

router.get("/profile", authenticateAdmin, (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.admin.id,
      email: req.admin.email,
      name: req.admin.name,
      role: req.admin.role,
    },
  })
})

router.get("/nucleos", authenticateAdmin, nucleosController.GetAllNucleos)
router.get("/nucleos/:id", authenticateAdmin, nucleosController.GetNucleoById)
router.patch("/nucleos/:id/status", authenticateAdmin, adminController.updateNucleoStatus)
router.post("/nucleos", authenticateAdmin, nucleosController.CreateNucleoByAdmin)
router.put("/nucleos/:id", authenticateAdmin, nucleosController.putNucleoWithoutFile)

module.exports = router
