const userService = require('../services/userService');

async function list(req, res, next) {
  try {
    const users = await userService.list();
    res.json(users);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { nome, email, senha } = req.body;
    if (!nome || !email) {
      return res.status(400).json({ error: 'Nome e email são obrigatórios' });
    }
    // FIX 9 — Senha obrigatória, mínimo 6 caracteres (remover senha padrão 'lider123')
    if (!senha || senha.length < 6) {
      return res.status(400).json({ error: 'Senha é obrigatória e deve ter pelo menos 6 caracteres' });
    }
    const user = await userService.create({ nome, email, senha });
    res.status(201).json(user);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const user = await userService.update(req.params.id, req.body);
    res.json(user);
  } catch (err) { next(err); }
}

async function deactivate(req, res, next) {
  try {
    const result = await userService.deactivate(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
}

async function activate(req, res, next) {
  try {
    const result = await userService.activate(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
}

async function resetKey(req, res, next) {
  try {
    const result = await userService.resetKey(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { list, create, update, deactivate, activate, resetKey };
