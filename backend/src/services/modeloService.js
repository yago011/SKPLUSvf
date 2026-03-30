const db = require('../db');

async function listByConta(conta_id, user) {
  // Verify access
  if (user.role !== 'admin') {
    const conta = await db.get('SELECT * FROM contas_skokka WHERE id = ? AND lider_id = ?', [conta_id, user.id]);
    if (!conta) throw Object.assign(new Error('Acesso negado a esta conta'), { status: 403 });
  }
  return db.all('SELECT * FROM modelos_cache WHERE conta_id = ? ORDER BY modelo', [conta_id]);
}

async function getByModelo(modelo, conta_id, user) {
  if (user.role !== 'admin') {
    const conta = await db.get('SELECT * FROM contas_skokka WHERE id = ? AND lider_id = ?', [conta_id, user.id]);
    if (!conta) throw Object.assign(new Error('Acesso negado a esta conta'), { status: 403 });
  }
  return db.get('SELECT * FROM modelos_cache WHERE modelo = ? AND conta_id = ?', [modelo, conta_id]);
}

async function upsert({ modelo, conta_id, quantidade_anuncios, numero_atual, links_edicao }) {
  const existing = await db.get('SELECT id FROM modelos_cache WHERE modelo = ? AND conta_id = ?', [modelo, conta_id]);

  if (existing) {
    await db.run(
      `UPDATE modelos_cache SET quantidade_anuncios = ?, numero_atual = ?, links_edicao = ?, ultima_atualizacao = datetime('now') WHERE modelo = ? AND conta_id = ?`,
      [quantidade_anuncios || 0, numero_atual || null, JSON.stringify(links_edicao || []), modelo, conta_id]
    );
  } else {
    await db.run(
      `INSERT INTO modelos_cache (modelo, conta_id, quantidade_anuncios, numero_atual, links_edicao) VALUES (?, ?, ?, ?, ?)`,
      [modelo, conta_id, quantidade_anuncios || 0, numero_atual || null, JSON.stringify(links_edicao || [])]
    );
  }

  return db.get('SELECT * FROM modelos_cache WHERE modelo = ? AND conta_id = ?', [modelo, conta_id]);
}

module.exports = { listByConta, getByModelo, upsert };
