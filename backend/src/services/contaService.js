const db = require('../db');

async function list(user) {
  if (user.role === 'admin') {
    return db.all('SELECT c.*, u.nome as lider_nome FROM contas_skokka c LEFT JOIN users u ON c.lider_id = u.id ORDER BY c.created_at DESC');
  }
  return db.all('SELECT * FROM contas_skokka WHERE lider_id = ? AND ativa = 1', [user.id]);
}

async function getById(id) {
  return db.get('SELECT * FROM contas_skokka WHERE id = ?', [id]);
}

async function create({ id, label }) {
  await db.run('INSERT INTO contas_skokka (id, label) VALUES (?, ?)', [id, label]);
  return getById(id);
}

async function update(id, { label, lider_id }) {
  const conta = await getById(id);
  if (!conta) throw Object.assign(new Error('Conta não encontrada'), { status: 404 });

  const newLabel = label !== undefined ? label : conta.label;
  const newLider = lider_id !== undefined ? lider_id : conta.lider_id;

  await db.run('UPDATE contas_skokka SET label = ?, lider_id = ? WHERE id = ?', [newLabel, newLider, id]);
  return getById(id);
}

async function deactivate(id) {
  const conta = await getById(id);
  if (!conta) throw Object.assign(new Error('Conta não encontrada'), { status: 404 });
  await db.run('UPDATE contas_skokka SET ativa = 0 WHERE id = ?', [id]);
  return { id, ativa: 0 };
}

module.exports = { list, getById, create, update, deactivate };
