const express = require('express');
const router = express.Router();
const ContatoControllers = require('../controllers/ContatoControllers')


router.post('/send-email', ContatoControllers.enviarEmail)

module.exports = router