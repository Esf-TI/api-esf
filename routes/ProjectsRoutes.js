const express = require("express")
const router = express.Router()
const ProjetcsControllers = require("../controllers/ProjectsControllers")
const multer = require("multer")

const uploadProjects = require("../middlewares/uploadsProjects")
const uploadImage = require("../middlewares/storageUpload")
const supabase = require("../lib/supabaseClient")

// Multer em memória para upload de múltiplas fotos (capa + fotos extras)
const multiUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
}).fields([
  { name: "fotoCapa", maxCount: 1 },
  { name: "fotos", maxCount: 8 },
])

// Multer em memória para upload de foto única
const singleUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
}).single("photo")

// Multer para upload avulso de imagem (campo: imagem)
const singleImagem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true)
    else cb(new Error("Apenas imagens são permitidas"))
  },
}).single("imagem")

// UPLOAD DE IMAGEM AVULSA (retorna URL pública no bucket projetos)
router.post("/upload-imagem", singleImagem, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Nenhuma imagem enviada" })
  const image = req.file
  const ext = image.originalname.split(".").pop()
  const fileName = `imagens/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage
    .from("projetos")
    .upload(fileName, image.buffer, { contentType: image.mimetype, upsert: false })
  if (error) return res.status(500).json({ error: "Erro ao fazer upload da imagem" })
  const { data } = supabase.storage.from("projetos").getPublicUrl(fileName)
  res.json({ url: data.publicUrl })
})

// CRIAR PROJETO com upload de fotos (capa + extras via Supabase Storage)
router.post("/projetos", multiUpload, uploadProjects, ProjetcsControllers.createProject)

// CRIAR PROJETO sem upload (dados já têm URL)
router.post("/projetos1", ProjetcsControllers.createProjectDentro)

// RETORNAR TODOS OS PROJETOS
router.get("/projetos", ProjetcsControllers.returnProjects)

// RETORNAR TODOS PROJETOS DE UM NÚCLEO
router.get("/projetos/nucleos/:nucleoId", ProjetcsControllers.returnProjectsNucleo)

// RETORNAR UM PROJETO ESPECÍFICO
router.get("/projetos/:id", ProjetcsControllers.returnProjectById)

// ALTERAR TODOS OS CAMPOS (com fotos via Supabase Storage)
router.put("/projetos/:id", multiUpload, uploadProjects, ProjetcsControllers.editProjectById)

// ALTERAR TODOS OS CAMPOS sem upload
router.put("/projetosAlterar/:id", ProjetcsControllers.editProjectByIdWithout)

// ALTERAR SÓ UM CAMPO ESPECÍFICO (sem arquivo)
router.patch("/projetosedit/:id", ProjetcsControllers.patchProject)

// ATUALIZAR FOTO DE CAPA via Supabase Storage
router.patch("/projetoPhoto/:id", singleUpload, uploadImage, ProjetcsControllers.updatePhotoCapaProjeto)

// APAGAR O PROJETO
router.delete("/projetos/:id", ProjetcsControllers.deleteProjectById)

module.exports = router
