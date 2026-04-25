const express = require("express")
const router = express.Router()
const BlogController = require("../controllers/BlogController")
const { authenticateAdmin } = require("../middlewares/authFunctions")
const prisma = require("../lib/prismaClient")
const multer = require("multer")
const { uploadPublicBuffer } = require("../lib/storageService")

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) cb(null, true)
  else cb(new Error("Apenas imagens são permitidas"), false)
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
})

const uploadBlogImageToSupabase = async (req, res, next) => {
  try {
    if (!req.file) return next()
    const { objectPath, publicUrl } = await uploadPublicBuffer({
      bucket: "blog",
      folder: "images",
      file: req.file,
    })
    req.file = { ...req.file, filename: objectPath, publicUrl }
    next()
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Erro ao fazer upload da imagem" })
  }
}

router.post("/createBlog", authenticateAdmin, upload.single("image"), uploadBlogImageToSupabase, BlogController.CreateBlog)
router.get("/blog", BlogController.returnAllBlog)
router.get("/admin/blog", authenticateAdmin, (req, res) => {
  req.query.status = req.query.status || null
  BlogController.returnAllBlog(req, res)
})
router.get("/blog/:id", BlogController.returnBlogById)
router.patch("/updateBlog/:id", authenticateAdmin, upload.single("image"), uploadBlogImageToSupabase, BlogController.updateBlog)
router.delete("/blog/:id", authenticateAdmin, BlogController.deleteBlog)

router.get("/admin/blog/drafts", authenticateAdmin, (req, res) => {
  req.query.status = "draft"
  BlogController.returnAllBlog(req, res)
})

router.get("/admin/blog/stats", authenticateAdmin, async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [total, published, drafts, recentPosts] = await Promise.all([
      prisma.blog.count(),
      prisma.blog.count({ where: { status: "published" } }),
      prisma.blog.count({ where: { status: "draft" } }),
      prisma.blog.count({ where: { created_at: { gte: sevenDaysAgo } } }),
    ])

    res.json({ success: true, data: { total, published, drafts, recentPosts } })
  } catch (error) {
    res.status(500).json({ success: false, message: "Erro ao buscar estatísticas" })
  }
})

module.exports = router
