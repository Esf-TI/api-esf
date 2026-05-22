require("dotenv").config()
const fs = require("fs")
const path = require("path")
const prisma = require("../lib/prismaClient")
const { uploadPublicFile } = require("../lib/storageService")

const ROOT_UPLOADS = path.join(__dirname, "..", "uploads")

const readFileIfExists = async (fullPath) => {
  if (!fs.existsSync(fullPath)) return null
  return fs.promises.readFile(fullPath)
}

const inferMimeType = (fileName) => {
  const ext = path.extname(fileName).toLowerCase()
  if (ext === ".pdf") return "application/pdf"
  if (ext === ".png") return "image/png"
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg"
  if (ext === ".webp") return "image/webp"
  if (ext === ".gif") return "image/gif"
  return "application/octet-stream"
}

const migrateBlogImages = async () => {
  const posts = await prisma.blog.findMany({
    where: { image: { startsWith: "/uploads/blog/" } },
    select: { id: true, image: true },
  })

  let migrated = 0
  let skipped = 0

  for (const post of posts) {
    const fileName = path.basename(post.image)
    const fullPath = path.join(ROOT_UPLOADS, "blog", fileName)
    const fileBuffer = await readFileIfExists(fullPath)

    if (!fileBuffer) {
      skipped += 1
      continue
    }

    const { publicUrl } = await uploadPublicFile({
      bucket: "blog",
      folder: "images",
      fileName,
      fileBuffer,
      contentType: inferMimeType(fileName),
    })

    await prisma.blog.update({
      where: { id: post.id },
      data: { image: publicUrl },
    })

    migrated += 1
  }

  return { total: posts.length, migrated, skipped }
}

const migrateAnaisFiles = async () => {
  const records = await prisma.anais.findMany({
    where: {
      OR: [{ pdf_url: { startsWith: "/uploads/anais/" } }, { cover_image_url: { startsWith: "/uploads/anais/" } }],
    },
    select: { id: true, pdf_url: true, cover_image_url: true },
  })

  let migrated = 0
  let skipped = 0

  for (const record of records) {
    const data = {}

    if (record.pdf_url?.startsWith("/uploads/anais/")) {
      const fileName = path.basename(record.pdf_url)
      const fullPath = path.join(ROOT_UPLOADS, "anais", fileName)
      const fileBuffer = await readFileIfExists(fullPath)
      if (fileBuffer) {
        const { publicUrl } = await uploadPublicFile({
          bucket: "anais",
          folder: "pdfs",
          fileName,
          fileBuffer,
          contentType: "application/pdf",
        })
        data.pdf_url = publicUrl
        migrated += 1
      } else {
        skipped += 1
      }
    }

    if (record.cover_image_url?.startsWith("/uploads/anais/")) {
      const fileName = path.basename(record.cover_image_url)
      const fullPath = path.join(ROOT_UPLOADS, "anais", fileName)
      const fileBuffer = await readFileIfExists(fullPath)
      if (fileBuffer) {
        const { publicUrl } = await uploadPublicFile({
          bucket: "anais",
          folder: "covers",
          fileName,
          fileBuffer,
          contentType: inferMimeType(fileName),
        })
        data.cover_image_url = publicUrl
        migrated += 1
      } else {
        skipped += 1
      }
    }

    if (Object.keys(data).length > 0) {
      await prisma.anais.update({ where: { id: record.id }, data })
    }
  }

  return { total: records.length, migrated, skipped }
}

async function main() {
  console.log("Iniciando migração de uploads locais para Supabase...")

  const blog = await migrateBlogImages()
  const anais = await migrateAnaisFiles()

  console.log("Migração concluída.")
  console.log("Blog:", blog)
  console.log("Anais:", anais)
}

main()
  .catch((error) => {
    console.error("Falha na migração:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
