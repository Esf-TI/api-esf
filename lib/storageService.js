const path = require("path")
const supabase = require("./supabaseClient")
const { optimizeImage } = require("./imageOptimizer")

const randomSuffix = () => Math.random().toString(36).slice(2, 10)

const buildObjectPath = (folder, originalName, newExt) => {
  const ext = newExt ? `.${newExt}` : (path.extname(originalName || "").toLowerCase() || "")
  return `${folder}/${Date.now()}-${randomSuffix()}${ext}`
}

const uploadPublicBuffer = async ({ bucket, folder, file }) => {
  if (!file?.buffer) {
    throw new Error("Arquivo inválido para upload")
  }

  let buffer = file.buffer
  let contentType = file.mimetype
  let newExt = null

  if (file.mimetype && file.mimetype.startsWith("image/")) {
    try {
      const optimized = await optimizeImage(file.buffer)
      if (optimized) {
        buffer = optimized
        contentType = "image/webp"
        newExt = "webp"
      }
    } catch (err) {
      console.error("Erro ao otimizar imagem no uploadPublicBuffer:", err)
    }
  }

  const objectPath = buildObjectPath(folder, file.originalname, newExt)
  const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
    contentType,
    upsert: false,
  })

  if (error) {
    throw new Error(`Falha no upload (${bucket}): ${error.message}`)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath)
  return { objectPath, publicUrl: data.publicUrl }
}

const uploadPublicFile = async ({ bucket, folder, fileName, fileBuffer, contentType }) => {
  let buffer = fileBuffer
  let currentContentType = contentType
  let currentFileName = fileName

  if (contentType && contentType.startsWith("image/")) {
    try {
      const optimized = await optimizeImage(fileBuffer)
      if (optimized) {
        buffer = optimized
        currentContentType = "image/webp"
        const parsed = path.parse(fileName)
        currentFileName = `${parsed.name}.webp`
      }
    } catch (err) {
      console.error("Erro ao otimizar imagem no uploadPublicFile:", err)
    }
  }

  const objectPath = buildObjectPath(folder, currentFileName)
  const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
    contentType: currentContentType,
    upsert: false,
  })

  if (error) {
    throw new Error(`Falha no upload (${bucket}): ${error.message}`)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath)
  return { objectPath, publicUrl: data.publicUrl }
}

module.exports = {
  uploadPublicBuffer,
  uploadPublicFile,
}
