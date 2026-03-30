module.exports = {
  LIST_ALL: 'SELECT id, nome, email, role, chave_extensao, ativo, created_at, updated_at FROM users ORDER BY created_at DESC',
  GET_BY_ID: 'SELECT id, nome, email, role, chave_extensao, ativo, created_at, updated_at FROM users WHERE id = ?',
  GET_BY_EMAIL: 'SELECT * FROM users WHERE email = ?',
  INSERT: `INSERT INTO users (id, nome, email, senha_hash, role, chave_extensao, ativo)
           VALUES (?, ?, ?, ?, 'lider', ?, 1)`,
  UPDATE: "UPDATE users SET nome = ?, email = ?, updated_at = datetime('now') WHERE id = ?",
  DEACTIVATE: "UPDATE users SET ativo = 0, updated_at = datetime('now') WHERE id = ?",
  ACTIVATE: "UPDATE users SET ativo = 1, updated_at = datetime('now') WHERE id = ?",
  UPDATE_KEY: "UPDATE users SET chave_extensao = ?, updated_at = datetime('now') WHERE id = ?",
};
