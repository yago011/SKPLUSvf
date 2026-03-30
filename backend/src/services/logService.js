const db = require('../db');

async function create({ conta_id, acao, detalhes }, user) {
  await db.run(
    'INSERT INTO logs_atividade (lider_id, conta_id, acao, detalhes) VALUES (?, ?, ?, ?)',
    [user.id, conta_id || null, acao, detalhes ? JSON.stringify(detalhes) : null]
  );
  return { ok: true };
}

async function list({ lider_id, conta_id, acao, limit = 50, offset = 0 }, user) {
  let sql = 'SELECT l.*, u.nome as lider_nome FROM logs_atividade l LEFT JOIN users u ON l.lider_id = u.id WHERE 1=1';
  const params = [];

  if (user.role !== 'admin') {
    sql += ' AND l.lider_id = ?';
    params.push(user.id);
  } else if (lider_id) {
    sql += ' AND l.lider_id = ?';
    params.push(lider_id);
  }

  if (conta_id) { sql += ' AND l.conta_id = ?'; params.push(conta_id); }
  if (acao) { sql += ' AND l.acao = ?'; params.push(acao); }

  sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
  // FIX 15 — Limitar parâmetro limit para prevenir DoS
  const MAX_LIMIT = 200;
  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 50), MAX_LIMIT);
  const safeOffset = Math.max(0, parseInt(offset) || 0);
  params.push(safeLimit, safeOffset);

  return db.all(sql, params);
}

module.exports = { create, list };
