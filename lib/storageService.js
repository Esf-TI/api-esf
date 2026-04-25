const path = require("path")
const supabase = require("./supabaseClient")

const randomSuffix = () => Math.random().toString(36).slice(2, 10)

const buildObjectPath = (folder, originalName) => {
  const ext = path.extname(originalName || "").toLowerCase() || ""
  return `${folder}/${Date.now()}-${randomSuffix()}${ext}`
}

const uploadPublicBuffer = async ({ bucket, folder, file }) => {
  if (!file?.buffer) {
    throw new Error("Arquivo inválido para upload")
  }

  const objectPath = buildObjectPath(folder, file.originalname)
  const { error } = await supabase.storage.from(bucket).upload(objectPath, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  })

  if (error) {
    throw new Error(`Falha no upload (${bucket}): ${error.message}`)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath)
  return { objectPath, publicUrl: data.publicUrl }
}

const uploadPublicFile = async ({ bucket, folder, fileName, fileBuffer, contentType }) => {
  const objectPath = buildObjectPath(folder, fileName)
  const { error } = await supabase.storage.from(bucket).upload(objectPath, fileBuffer, {
    contentType,
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
