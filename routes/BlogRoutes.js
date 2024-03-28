const express = require('express');
const router = express.Router();
const BlogController = require('../controllers/BlogController');
const multer = require('multer');

const photo = multer({
  storage: multer.memoryStorage(),
  limits: 10 * 1024 * 1024,
}).single('imagem')
const uploadImage = require('../middlewares/storageUpload');

router.post('/',photo,uploadImage, BlogController.CreateBlog);

module.exports = router