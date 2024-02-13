const express = require('express');
const router = express.Router();
const NucleosControllers = require('../controllers/NucleosControllers');

const multer = require('multer');

const photo = multer({
    storage: multer.memoryStorage(),
    limits: 10 * 1024 * 1024,
}).single('photo')

const uploadImage = require('../middlewares/storageUpload');

router.post('/nucleos', photo, uploadImage, NucleosControllers.CreateNucleo);

router.post('/login', NucleosControllers.LoginNucleo);

router.get('/nucleos', NucleosControllers.GetAllNucleos);

router.get('/nucleos/:id', NucleosControllers.GetNucleoById)

module.exports = router;