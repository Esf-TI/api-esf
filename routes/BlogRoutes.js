const express = require("express")
const router = express.Router()
const BlogController = require("../controllers/BlogController")
const { authenticateAdmin } = require("../middlewares/authFunctions")
const multer = require("multer")
const connection = require("../connection") // Declare the connection variable

const photo = multer({
  storage: multer.memoryStorage(),
  limits: 10 * 1024 * 1024,
}).single("imagem")

const uploadImage = require("../middlewares/storageUpload")

router.post("/createBlog", authenticateAdmin, photo, uploadImage, BlogController.CreateBlog)
router.get("/blog", BlogController.returnAllBlog)
router.get("/blog/:id", BlogController.returnBlogById)
router.patch("/updateBlog/:id", authenticateAdmin, photo, uploadImage, BlogController.updateBlog)
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
