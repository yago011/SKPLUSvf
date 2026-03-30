const { body, query } = require('express-validator');
const validate = require('../middleware/validate');

const TIPOS_VALIDOS = ['mapeamento', 'trocar'];
const STATUS_VALIDOS = ['pendente', 'processando', 'concluida', 'erro'];

// FIX 11 — Validação de schema para rotas de tarefas
const createTarefaRules = [
  body('tipo').isIn(TIPOS_VALIDOS).withMessage(`tipo deve ser um de: ${TIPOS_VALIDOS.join(', ')}`),
  body('modelo').trim().notEmpty().withMessage('modelo é obrigatório'),
  body('conta_id').trim().notEmpty().withMessage('conta_id é obrigatório'),
  body('numero_novo').optional().trim(),
  validate,
];

const updateStatusRules = [
  body('status').isIn(STATUS_VALIDOS).withMessage('status inválido'),
  validate,
];

const getPendingRules = [
  query('conta_id').optional().trim(),
  validate,
];

module.exports = { createTarefaRules, updateStatusRules, getPendingRules };
