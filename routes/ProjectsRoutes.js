const express = require("express")
const router = express.Router()
const ProjetcsControllers = require("../controllers/ProjectsControllers")
const multer = require("multer")

const photo = multer({
  storage: multer.memoryStorage(),
  limits: 10 * 1024 * 1024,
}).single("photo")

const Multer = multer({
  storage: multer.memoryStorage(),
  limits: 10 * 1024 * 1024,
}).fields([
  { name: "fotoCapa", maxCount: 1 },
  { name: "fotos", maxCount: 8 },
])

const uploadProjects = require("../middlewares/uploadsProjects")
const uploadImage = require("../middlewares/storageUpload")
const verificarToken = require("../middlewares/verifyToken")

//CRIAR PROJETO ( PRECISA DO ID DO NÚCLEO QUE IRÁ RETORNAR APÓS O LOGIN)
router.post("/projetos", Multer, uploadImage, ProjetcsControllers.createProject)

//CRIAR PROJETO SEM UPLOAD
router.post("/projetos1", ProjetcsControllers.createProjectDentro)

//RETORNAR TODOS OS PROJETOS
router.get("/projetos", ProjetcsControllers.returnProjects)

//RETORNAR TODOS PROJETOS DE UM NUCLEO

router.get("/projetos/nucleos/:nucleoId", ProjetcsControllers.returnProjectsNucleo)

//RETORNAR UM PROJETO ESPECÍFICO
router.get("/projetos/:id", ProjetcsControllers.returnProjectById)

//ALTERAR TODOS OS CAMPOS DE UM PROJETO
router.put("/projetos/:id", Multer, uploadProjects, ProjetcsControllers.editProjectById)

//ALTERAR TODOS OS CAMPOS DE UM PROJETO
router.put("/projetosAlterar/:id", ProjetcsControllers.editProjectByIdWithout)

//ALTERAR SÓ UM CAMPO ESPECÍFICO DO PROJETO
router.patch("/projetosedit/:id", photo, uploadImage, ProjetcsControllers.patchProject)

//atuzaliza foto de capa do projeto
router.patch("/projetoPhoto/:id", photo, uploadImage, ProjetcsControllers.updatePhotoCapaProjeto)
//APAGAR O PROJETO
router.delete("/projetos/:id", ProjetcsControllers.deleteProjectById)

module.exports = router
