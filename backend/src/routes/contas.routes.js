const { Router } = require('express');
const controller = require('../controllers/contas.controller');
const { authenticateToken, requireAdmin, requireActive } = require('../middleware/auth');

const router = Router();

router.get('/', authenticateToken, requireActive, controller.list);
router.post('/', authenticateToken, requireActive, requireAdmin, controller.create);
router.patch('/:id', authenticateToken, requireActive, requireAdmin, controller.update);
router.delete('/:id', authenticateToken, requireActive, requireAdmin, controller.deactivate);

module.exports = router;
