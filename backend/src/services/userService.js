const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const Q = require('../db/queries/users.queries');

async function list() {
  return db.all(Q.LIST_ALL);
}

async function getById(id) {
  return db.get(Q.GET_BY_ID, [id]);
}

async function create({ nome, email, senha }) {
  // Check duplicate email
  const existing = await db.get(Q.GET_BY_EMAIL, [email]);
  if (existing) {
    throw Object.assign(new Error('Email já cadastrado'), { status: 409 });
  }

  const id = uuidv4();
  const senha_hash = await bcrypt.hash(senha, 10);
  const chave_extensao = crypto.randomBytes(32).toString('hex');

  await db.run(Q.INSERT, [id, nome, email, senha_hash, chave_extensao]);

  return {
    id,
    nome,
    email,
    role: 'lider',
    chave_extensao,
    ativo: 1,
  };
}

async function update(id, { nome, email }) {
  const user = await db.get(Q.GET_BY_ID, [id]);
  if (!user) {
    throw Object.assign(new Error('Usuário não encontrado'), { status: 404 });
  }

  await db.run(Q.UPDATE, [nome || user.nome, email || user.email, id]);
  return getById(id);
}

async function deactivate(id) {
  const user = await db.get(Q.GET_BY_ID, [id]);
  if (!user) {
    throw Object.assign(new Error('Usuário não encontrado'), { status: 404 });
  }
  await db.run(Q.DEACTIVATE, [id]);
  return { id, ativo: 0 };
}

async function activate(id) {
  const user = await db.get(Q.GET_BY_ID, [id]);
  if (!user) {
    throw Object.assign(new Error('Usuário não encontrado'), { status: 404 });
  }
  await db.run(Q.ACTIVATE, [id]);
  return { id, ativo: 1 };
}

async function resetKey(id) {
  const user = await db.get(Q.GET_BY_ID, [id]);
  if (!user) {
    throw Object.assign(new Error('Usuário não encontrado'), { status: 404 });
  }

  const chave_extensao = crypto.randomBytes(32).toString('hex');
  await db.run(Q.UPDATE_KEY, [chave_extensao, id]);
  return { id, chave_extensao };
}

module.exports = { list, getById, create, update, deactivate, activate, resetKey };
