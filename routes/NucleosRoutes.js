const express = require("express")
const router = express.Router()
const NucleosControllers = require("../controllers/NucleosControllers")
const { authenticateAdmin, authenticateNucleo } = require("../middlewares/authFunctions")
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
router.post("/upload-imagem", singleImagem, uploadImage, (req, res) => {
  if (!req.file?.publicUrl) return res.status(400).json({ error: "Nenhuma imagem enviada" })
  res.json({ url: req.file.publicUrl })
})

//ATUALIZA FOTO DO NUCLEO
router.patch("/photo/:id", authenticateNucleo, photo, uploadImage, NucleosControllers.updateNucleoFoto)
//LOGAR COMO NÚCLEO
router.post("/login", NucleosControllers.LoginNucleo)

//RETORNAR TODOS OS NÚCLEOS ( PARA ADMIN )
router.get("/nucleos", NucleosControllers.GetAllNucleos)

//RETORNAR APENAS OS NÚCLEOS APROVADOS
router.get("/nucleosaprovados", publicCache(60), NucleosControllers.GetNucleosAprovados)

//RETORNAR  UM NUCLEO ESPECÍFICO
router.get("/nucleos/:id", publicCache(60), NucleosControllers.GetNucleoById)

//ROTA PARA ATUALIZAR O STATUS DE UM NÚCLEO ( VALORES POSSÍVEIS: pending, reproved, approved)
router.patch("/status/:id", authenticateAdmin, NucleosControllers.updateNucleoStatus)

//ROTA PARA EDITAR QUALQUER CAMPO DO BANCO DE DADOS DO NÚCLEO ( EDIÇÃO DO PRÓPRIO NÚCLEO )
router.patch("/nucleos/:id", authenticateNucleo, NucleosControllers.patchNucleo)

router.put("/nucleos/:id", authenticateNucleo, NucleosControllers.putNucleoWithoutFile)

router.delete("/nucleos/:id", authenticateAdmin, NucleosControllers.deleteNucleo)

//ROTA PARA ENVIAR QUEM TEM INTERESSE EM CRIAR NUCLEO

router.post("/fundarnucleo", NucleosControllers.interestFoundingNucleo)

module.exports = router
