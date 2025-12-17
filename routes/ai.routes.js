const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');
const auth = require("../middleware/auth");

// Routes for AI
router.get('/health', auth, aiController.health);
router.get('/status/:doctorId', auth, aiController.getAIStatus);
router.patch('/toggle', auth, aiController.toggleAI);
router.post('/response/:doctorId', auth, aiController.getAIResponse);

module.exports = router;
