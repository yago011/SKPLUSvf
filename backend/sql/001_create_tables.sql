CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'lider' CHECK (role IN ('admin', 'lider')),
  chave_extensao TEXT UNIQUE,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contas_skokka (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  lider_id TEXT REFERENCES users(id),
  ativa INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS modelos_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  modelo TEXT NOT NULL,
  conta_id TEXT NOT NULL REFERENCES contas_skokka(id),
  quantidade_anuncios INTEGER DEFAULT 0,
  numero_atual TEXT,
  numero_antigo TEXT,
  links_edicao TEXT DEFAULT '[]',
  ultima_atualizacao TEXT DEFAULT (datetime('now')),
  UNIQUE (modelo, conta_id)
);

CREATE TABLE IF NOT EXISTS tarefas (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('mapeamento', 'trocar')),
  modelo TEXT NOT NULL,
  conta_id TEXT NOT NULL REFERENCES contas_skokka(id),
  lider_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'processando', 'concluida', 'erro')),
  numero_novo TEXT,
  numero_antigo TEXT,
  resultado TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tarefas_status_conta
  ON tarefas (status, conta_id) WHERE status = 'pendente';

CREATE TABLE IF NOT EXISTS logs_atividade (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lider_id TEXT REFERENCES users(id),
  conta_id TEXT REFERENCES contas_skokka(id),
  acao TEXT NOT NULL,
  detalhes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_logs_lider ON logs_atividade(lider_id);
CREATE INDEX IF NOT EXISTS idx_logs_conta ON logs_atividade(conta_id);
CREATE INDEX IF NOT EXISTS idx_logs_data ON logs_atividade(created_at DESC);
