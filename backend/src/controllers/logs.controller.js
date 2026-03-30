const logService = require('../services/logService');

async function create(req, res, next) {
  try {
    const { acao } = req.body;
    if (!acao) return res.status(400).json({ error: 'acao é obrigatória' });
    const result = await logService.create(req.body, req.user);
    res.status(201).json(result);
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const logs = await logService.list(req.query, req.user);
    res.json(logs);
  } catch (err) { next(err); }
}

module.exports = { create, list };
