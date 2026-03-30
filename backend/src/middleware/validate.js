const { validationResult } = require('express-validator');

// FIX 11 — Middleware para extrair erros do express-validator e retornar 400
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

module.exports = validate;
