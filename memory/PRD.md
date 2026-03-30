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
