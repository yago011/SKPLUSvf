const db = require('../db');

async function getMetrics(user) {
  const isAdmin = user.role === 'admin';
  const liderFilter = isAdmin ? '' : ' AND t.lider_id = ?';
  const liderParam = isAdmin ? [] : [user.id];
  const contaFilter = isAdmin ? '' : ' AND lider_id = ?';

  const today = new Date().toISOString().split('T')[0];

  const trocas_hoje = await db.get(
    `SELECT COUNT(*) as n FROM tarefas t WHERE t.tipo = 'trocar' AND t.created_at >= '${today}'${liderFilter}`,
    liderParam
  );

  const mapeamentos_hoje = await db.get(
    `SELECT COUNT(*) as n FROM tarefas t WHERE t.tipo = 'mapeamento' AND t.created_at >= '${today}'${liderFilter}`,
    liderParam
  );

  const pendentes = await db.get(
    `SELECT COUNT(*) as n FROM tarefas t WHERE t.status = 'pendente'${liderFilter}`,
    liderParam
  );

  const erros = await db.get(
    `SELECT COUNT(*) as n FROM tarefas t WHERE t.status = 'erro'${liderFilter}`,
    liderParam
  );

  const total_contas = await db.get(
    `SELECT COUNT(*) as n FROM contas_skokka WHERE ativa = 1${contaFilter}`,
    isAdmin ? [] : [user.id]
  );

  const total_modelos = isAdmin
    ? await db.get('SELECT COUNT(*) as n FROM modelos_cache')
    : await db.get(
        'SELECT COUNT(*) as n FROM modelos_cache WHERE conta_id IN (SELECT id FROM contas_skokka WHERE lider_id = ?)',
        [user.id]
      );

  return {
    trocas_hoje: trocas_hoje.n,
    mapeamentos_hoje: mapeamentos_hoje.n,
    tarefas_pendentes: pendentes.n,
    tarefas_erro: erros.n,
    total_contas: total_contas.n,
    total_modelos: total_modelos.n,
  };
}

module.exports = { getMetrics };
