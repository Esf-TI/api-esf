const express = require('express');
const router = express.Router();
const NucleosControllers = require('../controllers/NucleosControllers');

const multer = require('multer');

const photo = multer({
    storage: multer.memoryStorage(),
    limits: 10 * 1024 * 1024,
}).single('fotoCapa')

const uploadImage = require('../middlewares/storageUpload');

//CRIAR NÚCLEO
router.post('/nucleos', photo, uploadImage, NucleosControllers.CreateNucleo);

//ATUALIZA FOTO DO NUCLEO
router.patch('/photo/:id', photo, uploadImage, NucleosControllers.updateNucleoFoto)
//LOGAR COMO NÚCLEO
router.post('/login', NucleosControllers.LoginNucleo);

//RETORNAR TODOS OS NÚCLEOS ( PARA ADMIN )
router.get('/nucleos', NucleosControllers.GetAllNucleos);

//RETORNAR  UM NUCLEO ESPECÍFICO
router.get('/nucleos/:id', NucleosControllers.GetNucleoById)

//RETORNAR TODOS OS NÚCLEOS APROVADOS ( TELAS HOMES DE APRESENTAÇÃO DOS NÚCLEOS)
router.get('/nucleosaprovados', NucleosControllers.getApprovedNucleos)

//ROTA PARA ATUALIZAR O STATUS DE UM NÚCLEO ( VALORES POSSÍVEIS: pending, reproved, approved)
router.patch('/status/:id', NucleosControllers.updateNucleoStatus)

//ROTA PARA EDITAR QUALQUER CAMPO DO BANCO DE DADOS DO NÚCLEO ( EDIÇÃO DO PRÓPRIO NÚCLEO )
router.patch('/nucleos/:id', NucleosControllers.patchNucleo)

router.delete('/nucleos/:id', NucleosControllers.deleteNucleo)

module.exports = router;