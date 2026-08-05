const express = require("express")
const router = express.Router()
const NucleosControllers = require("../controllers/NucleosControllers")
const { authenticateAdmin, authenticateNucleo, authenticateAdminOrNucleo, ensureNucleoSelf } = require("../middlewares/authFunctions")
const { publicCache } = require("../middlewares/cacheControl")

const multer = require("multer")

const photo = multer({
  storage: multer.memoryStorage(),
  limits: 10 * 1024 * 1024,
}).single("fotoCapa")

const singleImagem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true)
    else cb(new Error("Apenas imagens são permitidas"))
  },
}).single("imagem")

const uploadImage = require("../middlewares/storageUpload")

//CRIAR NÚCLEO
router.post("/nucleos", photo, uploadImage, NucleosControllers.CreateNucleo)

//UPLOAD DE IMAGEM AVULSA (retorna URL pública no bucket nucleos)
router.post("/upload-imagem", authenticateAdminOrNucleo, singleImagem, uploadImage, (req, res) => {
  if (!req.file?.publicUrl) return res.status(400).json({ error: "Nenhuma imagem enviada" })
  res.json({ url: req.file.publicUrl })
})

//ATUALIZA FOTO DO NUCLEO (só o próprio núcleo, ou um admin)
router.patch("/photo/:id", authenticateAdminOrNucleo, ensureNucleoSelf, photo, uploadImage, NucleosControllers.updateNucleoFoto)
//LOGAR COMO NÚCLEO
router.post("/login", NucleosControllers.LoginNucleo)

//RENOVAR TOKEN DE ACESSO DO NÚCLEO (usado pelo interceptor do front em /nucleos/auth/refresh)
router.post("/auth/refresh", NucleosControllers.RefreshNucleoToken)

//RETORNAR TODOS OS NÚCLEOS ( PARA ADMIN )
router.get("/nucleos", NucleosControllers.GetAllNucleos)

//RETORNAR APENAS OS NÚCLEOS APROVADOS
router.get("/nucleosaprovados", publicCache(60), NucleosControllers.GetNucleosAprovados)

//RETORNAR  UM NUCLEO ESPECÍFICO
router.get("/nucleos/:id", publicCache(60), NucleosControllers.GetNucleoById)

//ROTA PARA ATUALIZAR O STATUS DE UM NÚCLEO ( VALORES POSSÍVEIS: pending, reproved, approved)
router.patch("/status/:id", authenticateAdmin, NucleosControllers.updateNucleoStatus)

//ROTA PARA EDITAR QUALQUER CAMPO DO BANCO DE DADOS DO NÚCLEO ( EDIÇÃO DO PRÓPRIO NÚCLEO )
// `ensureNucleoSelf`: sem isso, um núcleo logado editava os dados de qualquer outro.
router.patch("/nucleos/:id", authenticateAdminOrNucleo, ensureNucleoSelf, NucleosControllers.patchNucleo)

router.put("/nucleos/:id", authenticateAdminOrNucleo, ensureNucleoSelf, NucleosControllers.putNucleoWithoutFile)

router.delete("/nucleos/:id", authenticateAdmin, NucleosControllers.deleteNucleo)

//ROTA PARA ENVIAR QUEM TEM INTERESSE EM CRIAR NUCLEO

router.post("/fundarnucleo", NucleosControllers.interestFoundingNucleo)

module.exports = router
