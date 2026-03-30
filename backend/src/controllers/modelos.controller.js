const modeloService = require('../services/modeloService');

async function list(req, res, next) {
  try {
    const { conta_id } = req.query;
    if (!conta_id) return res.status(400).json({ error: 'conta_id é obrigatório' });
    const modelos = await modeloService.listByConta(conta_id, req.user);
    res.json(modelos);
  } catch (err) { next(err); }
}

async function getByModelo(req, res, next) {
  try {
    const { conta_id } = req.query;
    if (!conta_id) return res.status(400).json({ error: 'conta_id é obrigatório' });
    const modelo = await modeloService.getByModelo(req.params.modelo, conta_id, req.user);
    if (!modelo) return res.status(404).json({ error: 'Modelo não encontrado' });
    res.json(modelo);
  } catch (err) { next(err); }
}

async function upsert(req, res, next) {
  try {
    const { modelo, conta_id } = req.body;
    if (!modelo || !conta_id) return res.status(400).json({ error: 'modelo e conta_id são obrigatórios' });
    const result = await modeloService.upsert(req.body);
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { list, getByModelo, upsert };
