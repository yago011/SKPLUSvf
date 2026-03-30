const authService = require('../services/authService');

async function login(req, res, next) {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }
    const result = await authService.login(email, senha);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function loginExtensao(req, res, next) {
  try {
    const { chave } = req.body;
    if (!chave) {
      return res.status(400).json({ error: 'Chave de acesso é obrigatória' });
    }
    const result = await authService.loginExtensao(chave);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json(req.user);
}

module.exports = { login, loginExtensao, me };
