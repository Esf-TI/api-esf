const express = require('express');
const router = express.Router();
const NucleosControllers = require('../controllers/NucleosControllers');

router.post('/createNucleo', NucleosControllers.CreateNucleo);

router.post('/login', NucleosControllers.LoginNucleo);

module.exports = router;