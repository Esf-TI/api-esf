const express = require('express');
const router = express.Router();
const adminController = require('../controllers/AdminController');

router.post("/",  adminController.create);

router.post("/auth/refresh",  adminController.updateToken);

router.post("/login",  adminController.login);

module.exports = router