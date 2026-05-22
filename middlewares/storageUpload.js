const supabase = require("../lib/supabaseClient")

const DEFAULT_BUCKET = "nucleos"

const uploadImage = async (req, res, next) => {
  if (!req.file) return next()

  // Permite que a rota defina o bucket via req.uploadBucket, default: nucleos
  const BUCKET = req.uploadBucket || DEFAULT_BUCKET

  const image = req.file
  const ext = image.originalname.split(".").pop()
  const fileName = `imagens/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, image.buffer, { contentType: image.mimetype, upsert: false })

  if (error) {
    console.error(`Erro no upload para Supabase Storage [bucket: ${BUCKET}]:`, error.message)
    return res.status(500).json({ success: false, message: "Erro ao fazer upload da imagem" })
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName)

  req.file = { filename: fileName, publicUrl: data.publicUrl }
  next()
}

module.exports = uploadImage
