const express = require("express")
const router = express.Router()
const multer = require("multer")
const path = require("path")
const fs = require("fs")

// Garantir que a pasta uploads existe
const uploadDir = path.join(__dirname, "..", "uploads", "anais")
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Configuração do multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    // Gera um nome único para evitar conflitos
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    cb(null, `anais-${uniqueSuffix}${ext}`)
  },
})

// Filtro para aceitar apenas PDFs
const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true)
  } else {
    cb(new Error("Apenas arquivos PDF são permitidos"), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limite de 10MB
  },
})

// Rota de upload
router.post("/anais", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Nenhum arquivo enviado",
      })
    }

    // Retorna a URL do arquivo (relativa ao servidor)
    const fileUrl = `/uploads/anais/${req.file.filename}`

    return res.status(200).json({
      success: true,
      message: "Arquivo enviado com sucesso",
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        url: fileUrl,
      },
    })
  } catch (error) {
    console.error("Erro no upload:", error)
    return res.status(500).json({
      success: false,
      message: "Erro ao fazer upload do arquivo",
      error: error.message,
    })
  }
})

// Middleware de tratamento de erros do multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Arquivo muito grande. Tamanho máximo: 10MB",
      })
    }
  }
  return res.status(400).json({
    success: false,
    message: error.message,
  })
})

module.exports = router
