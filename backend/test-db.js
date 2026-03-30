const db = require('./src/db');

async function main() {
  try {
    await db.init();

    // Verify tables exist
    const tables = await db.all(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );
    console.log('Tabelas criadas:', tables.map(t => t.name).join(', '));

    // Verify admin was created
    const admin = await db.get("SELECT id, nome, email, role FROM users WHERE id = 'admin-001'");
    if (admin) {
      console.log(`Banco OK! Admin criado com email: ${admin.email}`);
      console.log(`  Nome: ${admin.nome}, Role: ${admin.role}`);
    } else {
      console.error('ERRO: Admin nao encontrado!');
    }

    await db.close();
    console.log('Conexao fechada.');
  } catch (err) {
    console.error('ERRO:', err.message);
    process.exit(1);
  }
}

main();
