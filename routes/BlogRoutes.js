const express = require('express');
const router = express.Router();
const BlogController = require('../controllers/BlogController');
const multer = require('multer');

const photo = multer({
  storage: multer.memoryStorage(),
  limits: 10 * 1024 * 1024,
}).single('imagem')
const uploadImage = require('../middlewares/storageUpload');
const { route } = require('./NucleosRoutes');

router.post('/createBlog', photo, uploadImage, BlogController.CreateBlog);

router.get('/blog', BlogController.returnAllBlog);

router.get('/blog/:id', BlogController.returnBlogById);


router.patch('/updateBlog/:id',photo, uploadImage, BlogController.updateBlog);

router.delete('/blog/:id', BlogController.deleteBlog);
module.exports = router