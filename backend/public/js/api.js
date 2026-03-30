const API_BASE = window.location.origin;

async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('sk_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    localStorage.removeItem('sk_token');
    localStorage.removeItem('sk_user');
    window.location.href = '/login.html';
    throw new Error('Sessão expirada');
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Erro ${res.status}`);
  }
  return data;
}

const api = {
  // Auth
  login: (email, senha) => apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) }),
  me: () => apiFetch('/api/auth/me'),

  // Users
  listUsers: () => apiFetch('/api/users'),
  createUser: (data) => apiFetch('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => apiFetch(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deactivateUser: (id) => apiFetch(`/api/users/${id}`, { method: 'DELETE' }),
  activateUser: (id) => apiFetch(`/api/users/${id}/activate`, { method: 'POST' }),
  resetKey: (id) => apiFetch(`/api/users/${id}/reset-key`, { method: 'POST' }),

  // Contas
  listContas: () => apiFetch('/api/contas'),
  createConta: (data) => apiFetch('/api/contas', { method: 'POST', body: JSON.stringify(data) }),
  updateConta: (id, data) => apiFetch(`/api/contas/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deactivateConta: (id) => apiFetch(`/api/contas/${id}`, { method: 'DELETE' }),

  // Dashboard
  dashboard: () => apiFetch('/api/dashboard'),

  // Tarefas / Logs
  listTarefas: (params) => apiFetch(`/api/tarefas?${new URLSearchParams(params)}`),
  listLogs: (params) => apiFetch(`/api/logs?${new URLSearchParams(params)}`),
};
