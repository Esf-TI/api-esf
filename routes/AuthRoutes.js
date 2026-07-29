const express = require("express")
const router = express.Router()
const { requestReset, resetPassword } = require("../controllers/PasswordResetController")

// Recuperação de senha (núcleos e admins). O e-mail identifica o tipo de conta.
router.post("/forgot-password", requestReset)
router.post("/reset-password", resetPassword)

module.exports = router
