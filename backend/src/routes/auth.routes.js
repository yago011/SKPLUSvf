const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { authenticateToken, requireActive } = require('../middleware/auth');

const router = Router();

router.post('/login', authController.login);
router.post('/extensao', authController.loginExtensao);
router.get('/me', authenticateToken, requireActive, authController.me);

module.exports = router;
