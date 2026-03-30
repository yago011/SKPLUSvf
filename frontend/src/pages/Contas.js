import { useState, useEffect } from 'react';
import { Plus, X, PencilSimple, Buildings } from '@phosphor-icons/react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Contas() {
  const { user } = useAuth();
  const [contas, setContas] = useState([]);
  const [liders, setLiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ id: '', label: '', lider_id: '' });
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [cr, lr] = await Promise.all([
        api.get('/api/contas'),
        user.role === 'admin' ? api.get('/api/users') : Promise.resolve({ data: [] }),
      ]);
      setContas(cr.data);
      setLiders(lr.data.filter(u => u.ativo));
    } finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditId(null); setForm({ id: '', label: '', lider_id: '' }); setError(''); setShowModal(true); };
  const openEdit = (c) => { setEditId(c.id); setForm({ id: c.id, label: c.label, lider_id: c.lider_id || '' }); setError(''); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (editId) await api.patch(`/api/contas/${editId}`, { label: form.label, lider_id: form.lider_id || null });
      else await api.post('/api/contas', { id: form.id, label: form.label, lider_id: form.lider_id || null });
      setShowModal(false); load();
    } catch (err) { setError(err.response?.data?.error || 'Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Desativar esta conta?')) return;
    try {
      await api.delete(`/api/contas/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao desativar conta');
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Contas Skokka</h1>
          <p className="text-[#64748b] text-sm mt-1">Contas de anúncios vinculadas ao sistema</p>
        </div>
        {user.role === 'admin' && (
          <button data-testid="btn-create-conta" onClick={openCreate}
            className="flex items-center gap-2 bg-gradient-to-r from-[#7c3aed] to-[#ec4899] text-white font-medium rounded-lg px-5 py-2.5 hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(124,58,237,0.3)]">
            <Plus size={16} weight="bold" />
            Nova Conta
          </button>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a2e] border border-[#7c3aed]/20 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">{editId ? 'Editar Conta' : 'Nova Conta'}</h2>
              <button data-testid="btn-close-conta" onClick={() => setShowModal(false)} className="text-[#64748b] hover:text-white"><X size={20} /></button>
            </div>
            {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm mb-4">{error}</div>}
            <form onSubmit={handleSave} data-testid="form-conta" className="space-y-4">
              {!editId && (
                <div>
                  <label className="block text-sm text-[#94a3b8] mb-2">ID da Conta</label>
                  <input data-testid="input-conta-id" value={form.id} onChange={e => setForm({ ...form, id: e.target.value })} required
                    placeholder="conta-principal" className="w-full bg-[#0f0f11] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-[#4a5568] focus:border-[#7c3aed] outline-none transition-all" />
                </div>
              )}
              <div>
                <label className="block text-sm text-[#94a3b8] mb-2">Nome / Label</label>
                <input data-testid="input-conta-label" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} required
                  placeholder="Nome da conta" className="w-full bg-[#0f0f11] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-[#4a5568] focus:border-[#7c3aed] outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-2">Líder Responsável</label>
                <select data-testid="select-conta-lider" value={form.lider_id} onChange={e => setForm({ ...form, lider_id: e.target.value })}
                  className="w-full bg-[#0f0f11] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-[#7c3aed] outline-none transition-all">
                  <option value="">— Sem líder —</option>
                  {liders.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 bg-[#0f0f11] border border-white/10 text-[#94a3b8] rounded-lg py-2.5 hover:border-white/20 transition-all">Cancelar</button>
                <button type="submit" data-testid="btn-submit-conta" disabled={saving}
                  className="flex-1 bg-gradient-to-r from-[#7c3aed] to-[#ec4899] text-white font-medium rounded-lg py-2.5 hover:opacity-90 disabled:opacity-50 transition-all">
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-[#1a1a2e] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-[#64748b]">Carregando contas...</div>
        ) : contas.length === 0 ? (
          <div className="p-10 text-center">
            <Buildings size={40} weight="duotone" className="text-[#64748b] mx-auto mb-3" />
            <p className="text-[#64748b] text-sm">Nenhuma conta cadastrada.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="table-contas">
              <thead>
                <tr className="border-b border-white/5">
                  {['ID', 'Nome', 'Líder', 'Status', ...(user.role === 'admin' ? ['Ações'] : [])].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs uppercase tracking-wider text-[#64748b]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contas.map(c => (
                  <tr key={c.id} data-testid={`row-conta-${c.id}`} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4 text-sm font-mono text-[#64748b]">{c.id}</td>
                    <td className="px-5 py-4 text-sm font-medium text-white">{c.label}</td>
                    <td className="px-5 py-4 text-sm text-[#94a3b8]">{c.lider_nome || '—'}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${c.ativa ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        {c.ativa ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    {user.role === 'admin' && (
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button data-testid={`btn-edit-conta-${c.id}`} onClick={() => openEdit(c)}
                            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-[#7c3aed]/20 text-[#a78bfa] hover:bg-[#7c3aed]/10 transition-all">
                            <PencilSimple size={12} />Editar
                          </button>
                          {c.ativa && (
                            <button data-testid={`btn-deactivate-conta-${c.id}`} onClick={() => handleDeactivate(c.id)}
                              className="text-xs px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all">
                              Desativar
                            </button>
                          )}
                        </div>
                      </td>
                    )}
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
