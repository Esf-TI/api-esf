const express = require("express")
const router = express.Router()
const BlogController = require("../controllers/BlogController")
const { authenticateAdmin } = require("../middlewares/authFunctions")
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const connection = require("../connection") // Declare the connection variable
const uploadDir = path.join(__dirname, "..", "uploads", "blog")
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, file.fieldname + "-" + uniqueSuffix + "." + file.originalname.split(".").pop())
  },
})

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true)
  } else {
    cb(new Error("Apenas imagens são permitidas"), false)
  }
}

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
})

// Imagens são armazenadas localmente na pasta uploads/blog (não mais no Firebase)

router.post("/createBlog", authenticateAdmin, upload.single("image"), BlogController.CreateBlog)
router.get("/blog", BlogController.returnAllBlog)
router.get("/admin/blog", authenticateAdmin, (req, res) => {
  // Admin pode ver todos os posts com todos os status
  req.query.status = req.query.status || null
  BlogController.returnAllBlog(req, res)
})
router.get("/blog/:id", BlogController.returnBlogById)
router.patch("/updateBlog/:id", authenticateAdmin, upload.single("image"), BlogController.updateBlog)
router.delete("/blog/:id", authenticateAdmin, BlogController.deleteBlog)

router.get("/admin/blog/drafts", authenticateAdmin, (req, res) => {
  req.query.status = "draft"
  BlogController.returnAllBlog(req, res)
})

router.get("/admin/blog/stats", authenticateAdmin, (req, res) => {
  const sql = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as drafts,
      SUM(CASE WHEN DATE(createdAt) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as recentPosts
    FROM Blog
  `

  connection.query(sql, (error, results) => {
    if (error) {
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar estatísticas",
      })
    }

    res.json({
      success: true,
      data: results[0],
    })
  })
})

module.exports = router
