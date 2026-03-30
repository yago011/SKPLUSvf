const db = require('../db');

async function list(user) {
  if (user.role === 'admin') {
    const contas = await db.all('SELECT * FROM contas_skokka ORDER BY created_at DESC');
    for (const c of contas) {
      c.lideres = await db.all('SELECT u.id, u.nome FROM users u JOIN contas_lideres cl ON u.id = cl.lider_id WHERE cl.conta_id = ?', [c.id]);
      c.lider_ids = c.lideres.map(l => l.id);
      c.lider_nome = c.lideres.map(l => l.nome).join(', ');
    }
    return contas;
  }
  return db.all('SELECT c.* FROM contas_skokka c JOIN contas_lideres cl ON c.id = cl.conta_id WHERE cl.lider_id = ? AND c.ativa = 1', [user.id]);
}

async function getById(id) {
  const c = await db.get('SELECT * FROM contas_skokka WHERE id = ?', [id]);
  if (!c) return null;
  c.lideres = await db.all('SELECT u.id, u.nome FROM users u JOIN contas_lideres cl ON u.id = cl.lider_id WHERE cl.conta_id = ?', [id]);
  c.lider_ids = c.lideres.map(l => l.id);
  return c;
}

async function create({ id, label, lider_ids }) {
  await db.run('INSERT INTO contas_skokka (id, label) VALUES (?, ?)', [id, label]);
  if (Array.isArray(lider_ids)) {
    for (const lid of lider_ids) {
      await db.run('INSERT OR IGNORE INTO contas_lideres (conta_id, lider_id) VALUES (?, ?)', [id, lid]);
    }
  }
  return getById(id);
}

async function update(id, { label, lider_ids }) {
  const conta = await getById(id);
  if (!conta) throw Object.assign(new Error('Conta não encontrada'), { status: 404 });

  const newLabel = label !== undefined ? label : conta.label;
  await db.run('UPDATE contas_skokka SET label = ? WHERE id = ?', [newLabel, id]);

  if (Array.isArray(lider_ids)) {
    await db.run('DELETE FROM contas_lideres WHERE conta_id = ?', [id]);
    for (const lid of lider_ids) {
      await db.run('INSERT OR IGNORE INTO contas_lideres (conta_id, lider_id) VALUES (?, ?)', [id, lid]);
    }
  }
  return getById(id);
}

async function deactivate(id) {
  const conta = await getById(id);
  if (!conta) throw Object.assign(new Error('Conta não encontrada'), { status: 404 });
  await db.run('UPDATE contas_skokka SET ativa = 0 WHERE id = ?', [id]);
  return { id, ativa: 0 };
}

module.exports = { list, getById, create, update, deactivate };
