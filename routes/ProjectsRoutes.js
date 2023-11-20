const express = require('express');
const router = express.Router();
const ProjetcsControllers = require('../controllers/ProjectsControllers')
const multer = require('multer');

const photo = multer({
    storage: multer.memoryStorage(),
    limits: 10 * 1024 * 1024,
}).single('photo')

const uploadImage = require('../middlewares/storageUpload');
const verificarToken = require('../middlewares/verifyToken');

router.post('/createProject',verificarToken, photo, uploadImage, ProjetcsControllers.createProject);

router.get('/projects',verificarToken, ProjetcsControllers.returnProjects);

router.get('/projects/:id', ProjetcsControllers.returnProjectById);

router.patch('/projects/:id', photo, uploadImage, ProjetcsControllers.editProjectById);

router.delete('/projects/:id', ProjetcsControllers.deleteProjectById);


module.exports = router;