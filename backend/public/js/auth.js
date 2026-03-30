// Check if user is logged in
function checkAuth() {
  const token = localStorage.getItem('sk_token');
  const user = localStorage.getItem('sk_user');
  if (!token || !user) {
    window.location.href = '/login.html';
    return null;
  }
  return JSON.parse(user);
}

// Get current user
function getUser() {
  const user = localStorage.getItem('sk_user');
  return user ? JSON.parse(user) : null;
}

function isAdmin() {
  const user = getUser();
  return user && user.role === 'admin';
}

// Logout
function logout() {
  localStorage.removeItem('sk_token');
  localStorage.removeItem('sk_user');
  window.location.href = '/login.html';
}

// Build sidebar
function buildSidebar(activePage) {
  const user = getUser();
  if (!user) return;

  const adminLinks = user.role === 'admin' ? `
    <a href="/admin-usuarios.html" class="${activePage === 'usuarios' ? 'active' : ''}">Usuarios</a>
    <a href="/admin-contas.html" class="${activePage === 'contas' ? 'active' : ''}">Contas</a>
  ` : '';

  document.getElementById('sidebar').innerHTML = `
    <div class="logo">
      <h1>SK+ PRO</h1>
      <small>Painel de Controle</small>
    </div>
    <nav>
      <a href="/dashboard.html" class="${activePage === 'dashboard' ? 'active' : ''}">Dashboard</a>
      ${adminLinks}
      <a href="/historico.html" class="${activePage === 'historico' ? 'active' : ''}">Historico</a>
      <a href="#" onclick="logout(); return false;">Sair</a>
    </nav>
    <div class="user-info">
      <div class="user-name">${user.nome}</div>
      <div>${user.role === 'admin' ? 'Administrador' : 'Lider'}</div>
    </div>
  `;
}

// Toast notifications
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
