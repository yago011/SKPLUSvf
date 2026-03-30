// FIX 13 — Testes de integração para autenticação
process.env.JWT_SECRET = 'test-secret-minimo-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.ADMIN_PASSWORD = 'AdminTest@123';

const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');

beforeAll(async () => {
  // Inicializa o banco em memória com todas as migrations antes dos testes
  await db.init();
});

afterAll(async () => {
  await db.close();
});

describe('POST /api/auth/login', () => {
  it('deve retornar 400 sem credenciais', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('deve retornar 401 com credenciais erradas', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'x@x.com', senha: 'wrongpassword' });
    expect(res.status).toBe(401);
  });
});
