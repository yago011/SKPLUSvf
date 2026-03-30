const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// FIX 1 — Validação de variáveis de ambiente obrigatórias
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

const db = require('./db');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const contasRoutes = require('./routes/contas.routes');
const modelosRoutes = require('./routes/modelos.routes');
const tarefasRoutes = require('./routes/tarefas.routes');
const logsRoutes = require('./routes/logs.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// FIX 5 — Content Security Policy reativada
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// FIX 3 — CORS: validar origins dinâmicas, remover wildcard irrestrito
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
    // Permite todas as Chrome Extensions (background.js não tem origin HTTP)
    if (origin.startsWith('chrome-extension://')) return callback(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(Object.assign(new Error(`Origin bloqueada pelo CORS: ${origin}`), { status: 403 }));
  },
  credentials: true,
}));

app.use(express.json());

// FIX 6 — Rate limit global + rate limit agressivo para login
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 10,                    // máximo 10 tentativas
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// Aplicar apenas nas rotas de auth sensíveis
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/extensao', loginLimiter);

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Health check
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/contas', contasRoutes);
app.use('/api/modelos', modelosRoutes);
app.use('/api/tarefas', tarefasRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Error handler
app.use(errorHandler);

// Start
async function start() {
  try {
    await db.init();
    app.listen(PORT, () => {
      logger.info(`[API] SK+ PRO SaaS rodando em http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error(`Falha ao iniciar: ${err.message}`);
    process.exit(1);
  }
}

// Inicia apenas quando executado diretamente (não via require em testes)
if (require.main === module) {
  start();
}

module.exports = app;
