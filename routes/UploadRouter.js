const express = require("express")
const router = express.Router()
const multer = require("multer")
const { uploadPublicBuffer } = require("../lib/storageService")

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true)
  } else {
    cb(new Error("Apenas arquivos PDF são permitidos"), false)
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limite de 10MB
  },
})

// Rota de upload
router.post("/anais", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Nenhum arquivo enviado",
      })
    }

    const { objectPath, publicUrl } = await uploadPublicBuffer({
      bucket: "anais",
      folder: "pdfs",
      file: req.file,
    })

    return res.status(200).json({
      success: true,
      message: "Arquivo enviado com sucesso",
      data: {
        filename: objectPath,
        originalName: req.file.originalname,
        size: req.file.size,
        url: publicUrl,
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
