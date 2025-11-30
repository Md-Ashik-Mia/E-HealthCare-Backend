// routes/user.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const userController = require('../controllers/user.controller');

router.get('',auth,role("admin"),userController.getAllUsers)
// Change POST to GET since you're retrieving data
router.get('/doctors', userController.getApprovedDoctors);
router.get('/doctors/approved', auth,role('admin'),  userController.getAllDoctors);

module.exports = router;
