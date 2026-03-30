import { useState, useEffect } from 'react';
import { Copy, ArrowClockwise, Check, X, UserPlus } from '@phosphor-icons/react';
import api from '../api';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(null);
  const [form, setForm] = useState({ nome: '', email: '', senha: '' });
  const [error, setError] = useState('');

  const load = async () => {
    try { const r = await api.get('/api/users'); setUsers(r.data); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true); setError('');
    try {
      await api.post('/api/users', form);
      setShowCreate(false);
      setForm({ nome: '', email: '', senha: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar usuário');
    } finally { setCreating(false); }
  };

  const handleToggle = async (u) => {
    try {
      if (u.ativo) {
        await api.delete(`/api/users/${u.id}`);       // desativar → DELETE /:id
      } else {
        await api.post(`/api/users/${u.id}/activate`); // ativar   → POST /:id/activate
      }
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao alterar status do usuário');
    }
  };

  const handleResetKey = async (userId) => {
    const res = await api.post(`/api/users/${userId}/reset-key`);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, chave_extensao: res.data.chave_extensao } : u));
  };

  const copyKey = (key, id) => {
    navigator.clipboard.writeText(key);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuários</h1>
          <p className="text-[#64748b] text-sm mt-1">Gestão de líderes e administradores</p>
        </div>
        <button data-testid="btn-create-user" onClick={() => { setShowCreate(true); setError(''); }}
          className="flex items-center gap-2 bg-gradient-to-r from-[#7c3aed] to-[#ec4899] text-white font-medium rounded-lg px-5 py-2.5 hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(124,58,237,0.3)]">
          <UserPlus size={16} weight="bold" />
          Novo Usuário
        </button>
      </div>

      {/* Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a2e] border border-[#7c3aed]/20 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Criar Usuário</h2>
              <button data-testid="btn-close-create-user" onClick={() => setShowCreate(false)} className="text-[#64748b] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            {error && <div data-testid="create-user-error" className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm mb-4">{error}</div>}
            <form onSubmit={handleCreate} data-testid="form-create-user" className="space-y-4">
              {[
                { label: 'Nome', key: 'nome', type: 'text', placeholder: 'Nome completo' },
                { label: 'Email', key: 'email', type: 'email', placeholder: 'email@exemplo.com' },
                { label: 'Senha inicial', key: 'senha', type: 'text', placeholder: 'lider123' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm text-[#94a3b8] mb-2">{label}</label>
                  <input type={type} data-testid={`input-user-${key}`} value={form[key]}
                    onChange={e => setForm({ ...form, [key]: e.target.value })} required={key !== 'senha'}
                    placeholder={placeholder}
                    className="w-full bg-[#0f0f11] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-[#4a5568] focus:border-[#7c3aed] outline-none transition-all" />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 bg-[#0f0f11] border border-white/10 text-[#94a3b8] rounded-lg py-2.5 hover:border-white/20 transition-all">Cancelar</button>
                <button type="submit" data-testid="btn-submit-create-user" disabled={creating}
                  className="flex-1 bg-gradient-to-r from-[#7c3aed] to-[#ec4899] text-white font-medium rounded-lg py-2.5 hover:opacity-90 disabled:opacity-50 transition-all">
                  {creating ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#1a1a2e] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-[#64748b]">Carregando usuários...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="table-users">
              <thead>
                <tr className="border-b border-white/5">
                  {['Nome', 'Email', 'Role', 'Chave Extensão', 'Status', 'Ações'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs uppercase tracking-wider text-[#64748b]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} data-testid={`row-user-${u.id}`} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4 text-sm font-medium text-white">{u.nome}</td>
                    <td className="px-5 py-4 text-sm text-[#94a3b8]">{u.email}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${u.role === 'admin' ? 'bg-[#ec4899]/10 text-[#ec4899] border-[#ec4899]/20' : 'bg-[#7c3aed]/10 text-[#a78bfa] border-[#7c3aed]/20'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm">
                      {u.chave_extensao ? (
                        <div className="flex items-center gap-2">
                          <code className="text-[#64748b] font-mono text-xs">{u.chave_extensao.substring(0, 10)}...</code>
                          <button data-testid={`btn-copy-key-${u.id}`} onClick={() => copyKey(u.chave_extensao, u.id)}
                            className="text-[#7c3aed] hover:text-[#ec4899] transition-colors">
                            {copied === u.id ? <Check size={13} weight="bold" /> : <Copy size={13} />}
                          </button>
                        </div>
                      ) : <span className="text-[#64748b]">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${u.ativo ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button data-testid={`btn-toggle-user-${u.id}`} onClick={() => handleToggle(u)}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${u.ativo ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'}`}>
                          {u.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                        <button data-testid={`btn-reset-key-${u.id}`} onClick={() => handleResetKey(u.id)} title="Resetar chave de extensão"
                          className="p-1.5 rounded-lg border border-[#7c3aed]/20 text-[#a78bfa] hover:bg-[#7c3aed]/10 transition-all">
                          <ArrowClockwise size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
