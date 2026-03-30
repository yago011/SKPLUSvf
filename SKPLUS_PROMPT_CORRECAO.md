# PROMPT AVANÇADO DE CORREÇÃO — SK+ PRO (yago011/SKPLUS)

> **Instruções para a IDE:** Execute as correções abaixo em ordem de prioridade (🔴 → 🟡 → 🔵).  
> Não pule nenhum item. Após cada bloco, rode os testes disponíveis antes de avançar.

---

## CONTEXTO DO PROJETO

Você está corrigindo o projeto **SK+ PRO SaaS**, um sistema backend Node.js/Express com SQLite e uma extensão Chrome MV3. A estrutura principal é:

```
backend/
  src/
    server.js              ← Entry point Express
    middleware/auth.js     ← JWT middleware
    controllers/           ← auth, users, contas, tarefas, modelos, logs, dashboard
    services/              ← lógica de negócio
    routes/                ← rotas Express
    db/sqlite.js           ← wrapper SQLite
  sql/
    001_create_tables.sql
    002_seed_admin.sql
  .env.example
extension/
  background.js            ← Service Worker Chrome MV3
  manifest.json
memory/PRD.md
```

---

## 🔴 BLOCO 1 — SEGURANÇA CRÍTICA (corrigir primeiro)

### FIX 1 — JWT_SECRET: nunca expor valor padrão

**Arquivo:** `backend/.env.example`

**Problema:** `JWT_SECRET=CHANGE_ME_IN_PRODUCTION` é um valor legível que qualquer pessoa pode usar para forjar tokens JWT válidos se o `.env` real não for trocado.

**Correção:**
```env
# backend/.env.example
PORT=3000
NODE_ENV=development
JWT_SECRET=                          # OBRIGATÓRIO: gere com: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
API_URL=http://localhost:3000
DB_PATH=./data/skplus_saas.db
LOG_LEVEL=info
ALLOWED_ORIGINS=http://localhost:3000  # Em produção: coloque a URL exata do frontend
```

**Adicionar em `backend/src/server.js` (logo após os requires):**
```javascript
// Validação de variáveis de ambiente obrigatórias
const REQUIRED_ENV = ['JWT_SECRET', 'NODE_ENV'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[FATAL] Variável de ambiente "${key}" não definida. Abortando.`);
    process.exit(1);
  }
}
if (process.env.JWT_SECRET === 'CHANGE_ME_IN_PRODUCTION') {
  console.error('[FATAL] JWT_SECRET está com valor padrão. Gere um secret seguro!');
  process.exit(1);
}
```

---

### FIX 2 — Senha admin: remover hash exposto do git

**Arquivo:** `backend/sql/002_seed_admin.sql`

**Problema:** O hash bcrypt da senha `admin123` está commitado publicamente. Qualquer pessoa pode usar essas credenciais.

**Correção — substituir o arquivo inteiro:**
```sql
-- 002_seed_admin.sql
-- Seed do admin padrão.
-- A senha é definida via variável de ambiente ADMIN_PASSWORD no startup.
-- Este arquivo NÃO insere senha — o script de inicialização faz isso programaticamente.

-- Placeholder: a inserção real é feita por db/sqlite.js na função init()
SELECT 1; -- no-op
```

**Adicionar em `backend/src/db/sqlite.js`, dentro da função `init()`, após as migrations:**
```javascript
// Cria admin padrão com senha via ENV (nunca hardcodada)
const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminPassword) {
  console.error('[FATAL] ADMIN_PASSWORD não definida no .env');
  process.exit(1);
}
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
```

**Adicionar ao `.env.example`:**
```env
ADMIN_EMAIL=admin@skplus.com.br
ADMIN_PASSWORD=                    # OBRIGATÓRIO: defina uma senha forte antes de rodar
```

---

### FIX 3 — CORS: remover wildcard, validar origins

**Arquivo:** `backend/src/server.js`

**Substituir o bloco de CORS atual por:**
```javascript
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

if (allowedOrigins.includes('*')) {
  console.warn('[AVISO] ALLOWED_ORIGINS=* — nunca use em produção!');
}

app.use(cors({
  origin: (origin, callback) => {
    // Permite requests sem origin (ex: mobile apps, curl em dev)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`Origin bloqueada pelo CORS: ${origin}`));
  },
  credentials: true,
}));
```

---

### FIX 4 — Autorização em updateStatus (qualquer user atualiza tarefas alheias)

**Arquivo:** `backend/src/services/tarefaService.js`

**Substituir a função `updateStatus` por:**
```javascript
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
```

**Atualizar o controller `backend/src/controllers/tarefas.controller.js`:**
```javascript
async function updateStatus(req, res, next) {
  try {
    const { status, resultado } = req.body;
    if (!status) return res.status(400).json({ error: 'status é obrigatório' });
    // Passar req.user para verificação de ownership
    const tarefa = await tarefaService.updateStatus(req.params.id, { status, resultado }, req.user);
    res.json(tarefa);
  } catch (err) { next(err); }
}
```

---

### FIX 5 — Reativar Content Security Policy

**Arquivo:** `backend/src/server.js`

**Substituir:**
```javascript
// ANTES (inseguro):
app.use(helmet({ contentSecurityPolicy: false }));

// DEPOIS (seguro):
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // remover unsafe-inline se possível
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,  // necessário se servir assets estáticos externos
}));
```

---

### FIX 6 — Rate limit dedicado para login (anti brute-force)

**Arquivo:** `backend/src/server.js`

**Adicionar antes das rotas:**
```javascript
const rateLimit = require('express-rate-limit');

// Rate limit global (manter o atual)
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false }));

// Rate limit agressivo só para login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 10,                    // máximo 10 tentativas
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,  // não conta logins bem-sucedidos
});

// Aplicar apenas nas rotas de auth
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/extensao', loginLimiter);
```

---

## 🟡 BLOCO 2 — BUGS LÓGICOS

### FIX 7 — Race condition em getPending: usar transação SQLite

**Arquivo:** `backend/src/services/tarefaService.js`

**Substituir a função `getPending` por:**
```javascript
async function getPending(conta_id, user) {
  // Verificar acesso
  if (user.role !== 'admin') {
    const conta = await db.get('SELECT * FROM contas_skokka WHERE id = ? AND lider_id = ?', [conta_id, user.id]);
    if (!conta) throw Object.assign(new Error('Acesso negado a esta conta'), { status: 403 });
  }

  // Usar transação para garantir atomicidade (evita race condition com múltiplas extensões)
  const rawDb = db.getDb();
  let tarefa = null;

  await rawDb.run('BEGIN IMMEDIATE');
  try {
    tarefa = await rawDb.get(
      `SELECT * FROM tarefas WHERE conta_id = ? AND status = 'pendente' ORDER BY created_at ASC LIMIT 1`,
      [conta_id]
    );
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
```

---

### FIX 8 — Migrations: controle de versão (não rodar em loop)

**Arquivo:** `backend/src/db/sqlite.js`

**Substituir o bloco de migrations por:**
```javascript
// Tabela de controle de migrations
await db.run(`
  CREATE TABLE IF NOT EXISTS _migrations (
    filename TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const sqlDir = path.resolve(__dirname, '../../sql');
const files = fs.readdirSync(sqlDir).filter(f => f.endsWith('.sql')).sort();

for (const file of files) {
  // Ignorar o seed do admin antigo (002) — agora é feito programaticamente
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
```

---

### FIX 9 — Senha padrão "lider123": forçar senha obrigatória

**Arquivo:** `backend/src/controllers/users.controller.js`

**Substituir a função `create` por:**
```javascript
async function create(req, res, next) {
  try {
    const { nome, email, senha } = req.body;
    if (!nome || !email) {
      return res.status(400).json({ error: 'Nome e email são obrigatórios' });
    }
    if (!senha || senha.length < 8) {
      return res.status(400).json({ error: 'Senha é obrigatória e deve ter pelo menos 8 caracteres' });
    }
    const user = await userService.create({ nome, email, senha });
    res.status(201).json(user);
  } catch (err) { next(err); }
}
```

---

### FIX 10 — Atualizar PRD.md para refletir a arquitetura real

**Arquivo:** `memory/PRD.md`

**Substituir o conteúdo completo por:**
```markdown
# SK+ PRO SaaS — PRD (atualizado)

## Arquitetura Real (2026)

### Stack
- **Backend**: Node.js + Express 4 + SQLite (via sqlite/sqlite3) + bcryptjs + jsonwebtoken
- **Frontend estático**: HTML/CSS/JS servido pelo próprio Express em /public
- **Extensão**: Chrome Extension MV3 (Service Worker background.js)
- **Banco de dados**: SQLite — arquivo local em ./data/skplus_saas.db

> ⚠️ O PRD anterior descrevia Python/FastAPI/MongoDB. Essa arquitetura NÃO existe neste repositório.

### Estrutura de Tabelas (SQLite)
- `users` — id (UUID), nome, email, senha_hash, role (admin|lider), chave_extensao, ativo
- `contas_skokka` — id, label, lider_id, ativa
- `modelos_cache` — modelo, conta_id, quantidade_anuncios, numero_atual, links_edicao
- `tarefas` — id, tipo, modelo, conta_id, lider_id, status, numero_novo, resultado
- `logs_atividade` — lider_id, conta_id, acao, detalhes
- `_migrations` — controle de migrations aplicadas

### Credenciais
- Definidas via variáveis de ambiente (.env) — nunca hardcodadas
- Admin criado programaticamente no startup via ADMIN_EMAIL + ADMIN_PASSWORD
```

---

## 🔵 BLOCO 3 — QUALIDADE E MANUTENÇÃO

### FIX 11 — Adicionar validação de schema (express-validator)

**Instalar:**
```bash
cd backend && npm install express-validator
```

**Criar arquivo `backend/src/middleware/validate.js`:**
```javascript
const { validationResult } = require('express-validator');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

module.exports = validate;
```

**Criar `backend/src/validators/tarefas.validator.js`:**
```javascript
const { body, query } = require('express-validator');
const validate = require('../middleware/validate');

const TIPOS_VALIDOS = ['mapeamento', 'trocar'];
const STATUS_VALIDOS = ['pendente', 'processando', 'concluida', 'erro'];

const createTarefaRules = [
  body('tipo').isIn(TIPOS_VALIDOS).withMessage(`tipo deve ser um de: ${TIPOS_VALIDOS.join(', ')}`),
  body('modelo').trim().notEmpty().withMessage('modelo é obrigatório'),
  body('conta_id').trim().notEmpty().withMessage('conta_id é obrigatório'),
  body('numero_novo').optional().trim(),
  validate,
];

const updateStatusRules = [
  body('status').isIn(STATUS_VALIDOS).withMessage(`status inválido`),
  validate,
];

const getPendingRules = [
  query('conta_id').trim().notEmpty().withMessage('conta_id é obrigatório'),
  validate,
];

module.exports = { createTarefaRules, updateStatusRules, getPendingRules };
```

**Atualizar `backend/src/routes/tarefas.routes.js`:**
```javascript
const { createTarefaRules, updateStatusRules, getPendingRules } = require('../validators/tarefas.validator');

router.post('/', createTarefaRules, controller.create);
router.get('/pending', getPendingRules, controller.getPending);
router.patch('/:id/status', updateStatusRules, controller.updateStatus);
router.get('/', controller.list);
```

---

### FIX 12 — Extension: persistir mutex no chrome.storage (MV3 service worker efêmero)

**Arquivo:** `extension/background.js`

**Substituir a variável global `isProcessingTask` e sua gestão:**

```javascript
// REMOVER:
// let isProcessingTask = false;

// SUBSTITUIR POR: funções de mutex persistente via chrome.storage
async function acquireLock() {
  return new Promise(resolve => {
    chrome.storage.local.get(['sk_processing_lock', 'sk_lock_ts'], (res) => {
      const locked = res.sk_processing_lock === true;
      const lockAge = Date.now() - (res.sk_lock_ts || 0);
      // Lock expira após 10 minutos (failsafe para SW morto no meio da tarefa)
      if (locked && lockAge < 10 * 60 * 1000) {
        resolve(false);  // não conseguiu o lock
      } else {
        chrome.storage.local.set({ sk_processing_lock: true, sk_lock_ts: Date.now() }, () => {
          resolve(true);  // lock adquirido
        });
      }
    });
  });
}

async function releaseLock() {
  return new Promise(resolve => {
    chrome.storage.local.remove(['sk_processing_lock', 'sk_lock_ts'], resolve);
  });
}
```

**Substituir todas as ocorrências de `isProcessingTask = true` por `await acquireLock()` e `isProcessingTask = false` por `await releaseLock()` em `handleMapAds`, `handleSwapPhone` e `pollTaskQueue`.**

**Substituir verificações `if (isProcessingTask)` por:**
```javascript
const lockAcquired = await acquireLock();
if (!lockAcquired) { /* já processando */ return; }
// ... código da tarefa ...
await releaseLock();
```

---

### FIX 13 — Adicionar script de testes no backend Node.js

**Instalar:**
```bash
cd backend && npm install --save-dev jest supertest
```

**Adicionar em `backend/package.json`:**
```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest --runInBand --forceExit",
    "test:watch": "jest --watch"
  },
  "jest": {
    "testEnvironment": "node",
    "testMatch": ["**/tests/**/*.test.js"]
  }
}
```

**Criar `backend/tests/auth.test.js`:**
```javascript
process.env.JWT_SECRET = 'test-secret-mínimo-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.ADMIN_PASSWORD = 'AdminTest@123';

const request = require('supertest');
const app = require('../src/server');

describe('POST /api/auth/login', () => {
  it('deve retornar 400 sem credenciais', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('deve retornar 401 com credenciais erradas', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'x@x.com', senha: 'wrong' });
    expect(res.status).toBe(401);
  });
});
```

---

### FIX 14 — Remover .gitconfig do repositório

**Executar:**
```bash
# Na raiz do repositório
git rm --cached .gitconfig
echo ".gitconfig" >> .gitignore
git commit -m "chore: remove .gitconfig exposto publicamente"
```

**Adicionar ao `.gitignore`:**
```
.gitconfig
*.gitconfig
```

---

### FIX 15 — Limitar parâmetro limit para prevenir DoS

**Arquivo:** `backend/src/services/tarefaService.js`

**Na função `list`, substituir a linha de limit/offset por:**
```javascript
const MAX_LIMIT = 200;
const safeLimit = Math.min(Math.max(1, parseInt(limit) || 50), MAX_LIMIT);
const safeOffset = Math.max(0, parseInt(offset) || 0);

sql += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
params.push(safeLimit, safeOffset);
```

**Aplicar o mesmo padrão em `logService.js` e qualquer outro service que aceite `limit` via query params.**

---

## CHECKLIST FINAL

Após aplicar todas as correções, verificar:

- [ ] `.env` de produção tem `JWT_SECRET` com 64+ chars aleatórios
- [ ] `.env` de produção tem `ADMIN_PASSWORD` forte (não admin123)
- [ ] `.env` de produção tem `ALLOWED_ORIGINS` com URL exata do frontend
- [ ] `002_seed_admin.sql` não contém mais hash de senha
- [ ] `.gitconfig` removido do tracking do git
- [ ] `npm test` passa sem erros
- [ ] Server não inicia sem as variáveis obrigatórias definidas
- [ ] Login falha após 10 tentativas em 15 minutos
- [ ] PATCH /tarefas/:id/status retorna 403 para usuário não-dono da tarefa
- [ ] getPending sob carga concorrente não retorna a mesma tarefa duas vezes

---

## ORDEM DE EXECUÇÃO RECOMENDADA

```
FIX 1 → FIX 2 → FIX 6    (segurança de autenticação)
FIX 3 → FIX 5             (segurança de transporte)
FIX 4                      (autorização)
FIX 7 → FIX 8             (bugs críticos de dados)
FIX 9 → FIX 15            (bugs de negócio)
FIX 10                     (documentação)
FIX 11 → FIX 12 → FIX 13 → FIX 14  (qualidade)
```
