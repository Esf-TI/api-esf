const express = require('express');
const router = express.Router();
const ProjetcsControllers = require('../controllers/ProjectsControllers')
const multer = require('multer');

const photo = multer({
    storage: multer.memoryStorage(),
    limits: 10 * 1024 * 1024,
}).single('photo')

const Multer = multer({
    storage: multer.memoryStorage(),
    limits: 10 * 1024 * 1024,
  }).fields([{ name: 'fotoCapa', maxCount: 1 }, { name: 'fotos', maxCount: 8 }])

const uploadProjects = require('../middlewares/uploadsProjects');
const uploadImage = require('../middlewares/storageUpload');
const verificarToken = require('../middlewares/verifyToken');

//CRIAR PROJETO ( PRECISA DO ID DO NÚCLEO QUE IRÁ RETORNAR APÓS O LOGIN)
router.post('/projetos', Multer, uploadProjects, ProjetcsControllers.createProject);

//RETORNAR TODOS OS PROJETOS
router.get('/projetos', ProjetcsControllers.returnProjects);

//RETORNAR TODOS PROJETOS DE UM NUCLEO
router.get('/projetos/:nucleoId', ProjetcsControllers.returnProjectsNucleo)
//RETORNAR UM PROJETO ESPECÍFICO
router.get('/projetos/:id', ProjetcsControllers.returnProjectById);

//ALTERAR TODOS OS CAMPOS DE UM PROJETO
router.put('/projetos/:id',  Multer, uploadProjects, ProjetcsControllers.editProjectById);

//ALTERAR SÓ UM CAMPO ESPECÍFICO DO PROJETO
router.patch('/projetosedit/:id', photo, uploadImage, ProjetcsControllers.patchProject);

//APAGAR O PROJETO
router.delete('/projetos/:id', ProjetcsControllers.deleteProjectById);


module.exports = router;