const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

async function login(email, senha) {
  const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) {
    throw Object.assign(new Error('Email ou senha inválidos'), { status: 401 });
  }
  if (user.ativo === 0) {
    throw Object.assign(new Error('Conta desativada'), { status: 403 });
  }

  const match = await bcrypt.compare(senha, user.senha_hash);
  if (!match) {
    throw Object.assign(new Error('Email ou senha inválidos'), { status: 401 });
  }

  const payload = { id: user.id, nome: user.nome, email: user.email, role: user.role };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

  return {
    token,
    user: { id: user.id, nome: user.nome, email: user.email, role: user.role },
  };
}

async function loginExtensao(chave) {
  const user = await db.get('SELECT * FROM users WHERE chave_extensao = ?', [chave]);
  if (!user) {
    throw Object.assign(new Error('Chave de acesso inválida'), { status: 401 });
  }
  if (user.ativo === 0) {
    throw Object.assign(new Error('Conta desativada'), { status: 403 });
  }

  const payload = { id: user.id, nome: user.nome, email: user.email, role: user.role };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

  const contas = await db.all(
    'SELECT c.id, c.label FROM contas_skokka c JOIN contas_lideres cl ON c.id = cl.conta_id WHERE cl.lider_id = ? AND c.ativa = 1',
    [user.id]
  );

  return {
    token,
    user: { id: user.id, nome: user.nome, role: user.role },
    contas,
  };
}

module.exports = { login, loginExtensao };
