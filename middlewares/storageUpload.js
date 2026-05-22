const supabase = require("../lib/supabaseClient")
const { optimizeImage } = require("../lib/imageOptimizer")

const DEFAULT_BUCKET = "nucleos"

const uploadImage = async (req, res, next) => {
  if (!req.file) return next()

  // Permite que a rota defina o bucket via req.uploadBucket, default: nucleos
  const BUCKET = req.uploadBucket || DEFAULT_BUCKET

  const image = req.file
  let buffer = image.buffer
  let contentType = image.mimetype
  let ext = image.originalname.split(".").pop()

  if (image.mimetype && image.mimetype.startsWith("image/")) {
    try {
      const optimized = await optimizeImage(image.buffer)
      if (optimized) {
        buffer = optimized
        contentType = "image/webp"
        ext = "webp"
      }
    } catch (err) {
      console.error("Erro ao otimizar imagem no storageUpload:", err)
    }
  }

  const fileName = `imagens/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, buffer, { contentType, upsert: false })

  if (error) {
    console.error(`Erro no upload para Supabase Storage [bucket: ${BUCKET}]:`, error.message)
    return res.status(500).json({ success: false, message: "Erro ao fazer upload da imagem" })
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName)

  req.file = { filename: fileName, publicUrl: data.publicUrl }
  next()
}

module.exports = uploadImage
