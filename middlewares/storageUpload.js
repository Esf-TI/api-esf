const supabase = require("../lib/supabaseClient")

const BUCKET = "nucleos"

const uploadImage = async (req, res, next) => {
  if (!req.file) return next()

  const image = req.file
  const ext = image.originalname.split(".").pop()
  const fileName = `imagens/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, image.buffer, { contentType: image.mimetype, upsert: false })

  if (error) {
    console.error("Erro no upload para Supabase Storage:", error.message)
    return res.status(500).json({ success: false, message: "Erro ao fazer upload da imagem" })
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName)

  req.file = { filename: fileName, publicUrl: data.publicUrl }
  next()
}

module.exports = uploadImage
