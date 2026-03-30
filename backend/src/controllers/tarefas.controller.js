const tarefaService = require('../services/tarefaService');

async function create(req, res, next) {
  try {
    const { tipo, modelo, conta_id } = req.body;
    if (!tipo || !modelo || !conta_id) {
      return res.status(400).json({ error: 'tipo, modelo e conta_id são obrigatórios' });
    }
    const tarefa = await tarefaService.create(req.body, req.user);
    res.status(201).json(tarefa);
  } catch (err) { next(err); }
}

async function getPending(req, res, next) {
  try {
    const { conta_id } = req.query;
    // conta_id is now optional. If not provided, service will find any pending task for the user
    const tarefa = await tarefaService.getPending(conta_id, req.user);
    res.json(tarefa);
  } catch (err) { next(err); }
}

async function updateStatus(req, res, next) {
  try {
    const { status, resultado } = req.body;
    if (!status) return res.status(400).json({ error: 'status é obrigatório' });
    // FIX 4 — Passar req.user para verificação de ownership
    const tarefa = await tarefaService.updateStatus(req.params.id, { status, resultado }, req.user);
    res.json(tarefa);
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const tarefas = await tarefaService.list(req.query, req.user);
    res.json(tarefas);
  } catch (err) { next(err); }
}

module.exports = { create, getPending, updateStatus, list };
