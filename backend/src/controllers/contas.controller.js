const contaService = require('../services/contaService');

async function list(req, res, next) {
  try {
    const contas = await contaService.list(req.user);
    res.json(contas);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { id, label } = req.body;
    if (!id || !label) return res.status(400).json({ error: 'ID e label são obrigatórios' });
    const conta = await contaService.create({ id, label });
    res.status(201).json(conta);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const conta = await contaService.update(req.params.id, req.body);
    res.json(conta);
  } catch (err) { next(err); }
}

async function deactivate(req, res, next) {
  try {
    const result = await contaService.deactivate(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { list, create, update, deactivate };
