const { Router } = require('express');
const controller = require('../controllers/logs.controller');
const { authenticateToken, requireActive } = require('../middleware/auth');

const router = Router();

router.use(authenticateToken, requireActive);

router.post('/', controller.create);
router.get('/', controller.list);

module.exports = router;
