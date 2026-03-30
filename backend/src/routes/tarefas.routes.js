const { Router } = require('express');
const controller = require('../controllers/tarefas.controller');
const { authenticateToken, requireActive } = require('../middleware/auth');
const { createTarefaRules, updateStatusRules, getPendingRules } = require('../validators/tarefas.validator');

const router = Router();

router.use(authenticateToken, requireActive);

router.post('/', createTarefaRules, controller.create);
router.get('/pending', getPendingRules, controller.getPending);
router.patch('/:id/status', updateStatusRules, controller.updateStatus);
router.get('/', controller.list);

module.exports = router;

