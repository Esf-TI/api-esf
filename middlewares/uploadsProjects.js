const supabase = require("../lib/supabaseClient")
const { optimizeImage } = require("../lib/imageOptimizer")

const BUCKET = "projetos"

const uploadToStorage = async (image) => {
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
      console.error("Erro ao otimizar imagem no uploadsProjects:", err)
    }
  }

  const fileName = `imagens/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, buffer, { contentType, upsert: false })

  if (error) throw new Error(`Upload falhou: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName)

  return { filename: fileName, publicUrl: data.publicUrl }
}

const uploadProjects = async (req, res, next) => {
  if (!req.files) return next()

  try {
    const fotoCapa = req.files["fotoCapa"]?.[0]
    const fotos = req.files["fotos"] || []

    if (!fotoCapa) return next()

    const [capaResult, ...fotosResults] = await Promise.all([
      uploadToStorage(fotoCapa),
      ...fotos.map(uploadToStorage),
    ])

    req.files = {
      fotoCapa: capaResult,
      foto: fotosResults,
    }

    next()
  } catch (error) {
    console.error("Erro no upload de projeto:", error.message)
    return res.status(500).json({ success: false, message: "Erro ao fazer upload das imagens" })
  }
}

module.exports = uploadProjects
