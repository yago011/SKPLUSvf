const { Router } = require('express');
const usersController = require('../controllers/users.controller');
const { authenticateToken, requireAdmin, requireActive } = require('../middleware/auth');

const router = Router();

// All routes require admin
router.use(authenticateToken, requireActive, requireAdmin);

router.get('/', usersController.list);
router.post('/', usersController.create);
router.patch('/:id', usersController.update);
router.delete('/:id', usersController.deactivate);
router.post('/:id/activate', usersController.activate);
router.post('/:id/reset-key', usersController.resetKey);

module.exports = router;
