const { v4: uuidv4 } = require('uuid');
const db = require('../db');

async function create({ tipo, modelo, conta_id, numero_novo, numero_antigo }, user) {
  // Verify lider has access to conta
  if (user.role !== 'admin') {
    const conta = await db.get('SELECT * FROM contas_skokka WHERE id = ? AND lider_id = ?', [conta_id, user.id]);
    if (!conta) throw Object.assign(new Error('Acesso negado a esta conta'), { status: 403 });
  }

  const id = uuidv4();
  await db.run(
    `INSERT INTO tarefas (id, tipo, modelo, conta_id, lider_id, numero_novo, numero_antigo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, tipo, modelo, conta_id, user.id, numero_novo || null, numero_antigo || null]
  );

  return db.get('SELECT * FROM tarefas WHERE id = ?', [id]);
}

// FIX 7 — Race condition: usar transação BEGIN IMMEDIATE para atomicidade
async function getPending(conta_id, user) {
  let contasPermitidas = [];

  // Se o usuário não for admin, buscou as contas dele
  if (user.role !== 'admin') {
    const contas = await db.all('SELECT id FROM contas_skokka WHERE lider_id = ? AND ativa = 1', [user.id]);
    contasPermitidas = contas.map(c => c.id);
    
    // Se passou um conta_id específico, verifica permissão
    if (conta_id && !contasPermitidas.includes(conta_id)) {
      throw Object.assign(new Error('Acesso negado a esta conta'), { status: 403 });
    }
  }

  // Usar transação para garantir atomicidade (evita race condition com múltiplas extensões)
  const rawDb = db.getDb();
  let tarefa = null;

  await rawDb.run('BEGIN IMMEDIATE');
  try {
    let sql = `SELECT * FROM tarefas WHERE status = 'pendente'`;
    const params = [];

    if (conta_id) {
      sql += ` AND conta_id = ?`;
      params.push(conta_id);
    } else if (user.role !== 'admin') {
      if (contasPermitidas.length === 0) {
        // Usuário não tem contas, não pode ter tarefas
        await rawDb.run('COMMIT');
        return null;
      }
      sql += ` AND conta_id IN (${contasPermitidas.map(() => '?').join(',')})`;
      params.push(...contasPermitidas);
    }

    sql += ` ORDER BY created_at ASC LIMIT 1`;

    tarefa = await rawDb.get(sql, params);

    if (tarefa) {
      await rawDb.run(
        `UPDATE tarefas SET status = 'processando', updated_at = datetime('now') WHERE id = ?`,
        [tarefa.id]
      );
      tarefa.status = 'processando';
    }
    await rawDb.run('COMMIT');
  } catch (err) {
    await rawDb.run('ROLLBACK');
    throw err;
  }

  return tarefa || null;
}

// FIX 4 — Autorização: apenas dono ou admin pode atualizar status
async function updateStatus(id, { status, resultado }, user) {
  const tarefa = await db.get('SELECT * FROM tarefas WHERE id = ?', [id]);
  if (!tarefa) throw Object.assign(new Error('Tarefa não encontrada'), { status: 404 });

  // Apenas o líder dono da tarefa ou um admin pode atualizar
  if (user.role !== 'admin' && tarefa.lider_id !== user.id) {
    throw Object.assign(new Error('Acesso negado a esta tarefa'), { status: 403 });
  }

  // Valida o status recebido
  const VALID_STATUS = ['pendente', 'processando', 'concluida', 'erro'];
  if (!VALID_STATUS.includes(status)) {
    throw Object.assign(new Error(`Status inválido: ${status}`), { status: 400 });
  }

  const isFinished = status === 'concluida' || status === 'erro';
  if (isFinished) {
    await db.run(
      `UPDATE tarefas SET status = ?, resultado = ?, updated_at = datetime('now'), completed_at = datetime('now') WHERE id = ?`,
      [status, resultado ? JSON.stringify(resultado) : null, id]
    );
  } else {
    await db.run(
      `UPDATE tarefas SET status = ?, resultado = ?, updated_at = datetime('now') WHERE id = ?`,
      [status, resultado ? JSON.stringify(resultado) : null, id]
    );
  }
  return db.get('SELECT * FROM tarefas WHERE id = ?', [id]);
}

async function list({ conta_id, status, lider_id, limit = 50, offset = 0 }, user) {
  let sql = 'SELECT t.*, u.nome as lider_nome FROM tarefas t LEFT JOIN users u ON t.lider_id = u.id WHERE 1=1';
  const params = [];

  if (user.role !== 'admin') {
    sql += ' AND t.lider_id = ?';
    params.push(user.id);
  } else if (lider_id) {
    sql += ' AND t.lider_id = ?';
    params.push(lider_id);
  }

  if (conta_id) { sql += ' AND t.conta_id = ?'; params.push(conta_id); }
  if (status) { sql += ' AND t.status = ?'; params.push(status); }

  // FIX 15 — Limitar parâmetro limit para prevenir DoS
  const MAX_LIMIT = 200;
  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 50), MAX_LIMIT);
  const safeOffset = Math.max(0, parseInt(offset) || 0);

  sql += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
  params.push(safeLimit, safeOffset);

  return db.all(sql, params);
}

module.exports = { create, getPending, updateStatus, list };
