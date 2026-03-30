const jwt = require('jsonwebtoken');
const db = require('../db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, nome: decoded.nome, email: decoded.email, role: decoded.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito ao administrador' });
  }
  next();
}

async function requireActive(req, res, next) {
  try {
    const user = await db.get('SELECT ativo FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(401).json({ error: 'Sessão inválida ou usuário removido. Faça login novamente.' });
    }
    if (user.ativo === 0) {
      return res.status(403).json({ error: 'Conta desativada' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticateToken, requireAdmin, requireActive };
