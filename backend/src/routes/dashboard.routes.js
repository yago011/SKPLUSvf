const { Router } = require('express');
const controller = require('../controllers/dashboard.controller');
const { authenticateToken, requireActive } = require('../middleware/auth');

const router = Router();

router.get('/', authenticateToken, requireActive, controller.get);

module.exports = router;
