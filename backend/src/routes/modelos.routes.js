const { Router } = require('express');
const controller = require('../controllers/modelos.controller');
const { authenticateToken, requireActive } = require('../middleware/auth');

const router = Router();

router.use(authenticateToken, requireActive);

router.get('/', controller.list);
router.get('/:modelo', controller.getByModelo);
router.post('/', controller.upsert);

module.exports = router;
