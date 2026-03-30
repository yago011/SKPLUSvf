const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

let db = null;

async function init() {
  const dbPath = process.env.DB_PATH === ':memory:'
    ? ':memory:'
    : path.resolve(__dirname, '../../', process.env.DB_PATH || './data/skplus_saas.db');

  if (dbPath !== ':memory:') {
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await db.run('PRAGMA journal_mode = WAL');
  await db.run('PRAGMA foreign_keys = ON');

  // FIX 8 — Tabela de controle de migrations (evita re-aplicar em loop)
  await db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const sqlDir = path.resolve(__dirname, '../../sql');
  const files = fs.readdirSync(sqlDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    // FIX 2 — Ignorar o seed do admin antigo (002) — agora é feito programaticamente
    if (file === '002_seed_admin.sql') continue;

    const already = await db.get('SELECT filename FROM _migrations WHERE filename = ?', [file]);
    if (already) {
      console.log(`[DB] Migration já aplicada: ${file} (skip)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(sqlDir, file), 'utf-8');
    await db.exec(sql);
    await db.run('INSERT INTO _migrations (filename) VALUES (?)', [file]);
    console.log(`[DB] Migration aplicada: ${file}`);
  }

  // FIX 2 — Cria admin padrão com senha via ENV (nunca hardcodada)
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    // Em ambiente de teste sem ADMIN_PASSWORD, pular criação do admin
    if (process.env.NODE_ENV !== 'test') {
      console.error('[FATAL] ADMIN_PASSWORD não definida no .env');
      process.exit(1);
    }
  } else {
    const existingAdmin = await db.get("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (!existingAdmin) {
      const bcrypt = require('bcryptjs');
      const { v4: uuidv4 } = require('uuid');
      const crypto = require('crypto');
      const hash = await bcrypt.hash(adminPassword, 12);
      const chave = crypto.randomBytes(32).toString('hex');
      await db.run(
        "INSERT INTO users (id, nome, email, senha_hash, role, chave_extensao, ativo) VALUES (?, ?, ?, ?, 'admin', ?, 1)",
        [uuidv4(), 'Admin', process.env.ADMIN_EMAIL || 'admin@skplus.com.br', hash, chave]
      );
      console.log('[DB] Admin padrão criado.');
    }
  }

  console.log(`[DB] SQLite iniciado: ${dbPath}`);
  return db;
}

async function close() {
  if (db) {
    await db.close();
    db = null;
  }
}

function getDb() {
  if (!db) throw new Error('Banco nao inicializado. Chame init() primeiro.');
  return db;
}

async function get(sql, params = []) {
  return getDb().get(sql, params);
}

async function all(sql, params = []) {
  return getDb().all(sql, params);
}

async function run(sql, params = []) {
  return getDb().run(sql, params);
}

async function exec(sql) {
  return getDb().exec(sql);
}

function isConnected() {
  return db !== null;
}

module.exports = { init, close, get, all, run, exec, isConnected, getDb };
