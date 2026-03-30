-- 003_many_to_many_lideres.sql
CREATE TABLE IF NOT EXISTS contas_lideres (
  conta_id TEXT REFERENCES contas_skokka(id) ON DELETE CASCADE,
  lider_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (conta_id, lider_id)
);

-- Migrate existing data
INSERT OR IGNORE INTO contas_lideres (conta_id, lider_id)
SELECT id, lider_id FROM contas_skokka WHERE lider_id IS NOT NULL;
