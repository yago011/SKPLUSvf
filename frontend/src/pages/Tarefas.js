import { useState, useEffect, useRef } from 'react';
import { Plus, X, ArrowsClockwise, Lightning, ArrowSquareOut, CheckCircle } from '@phosphor-icons/react';
import api from '../api';

const STATUS_CLASS = {
  pendente: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  processando: 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse',
  concluida: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  erro: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export default function Tarefas() {
  const [tarefas, setTarefas] = useState([]);
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ tipo: 'mapeamento', modelo: '', conta_id: '', numero_novo: '', numero_antigo: '' });
  const [error, setError] = useState('');
  const timer = useRef(null);

  const load = async () => {
    try {
      const [tr, cr] = await Promise.all([api.get('/api/tarefas?limit=50'), api.get('/api/contas')]);
      setTarefas(tr.data);
      setContas(cr.data);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    timer.current = setInterval(load, 6000);
    return () => clearInterval(timer.current);
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await api.post('/api/tarefas', {
        tipo: form.tipo, modelo: form.modelo, conta_id: form.conta_id,
        ...(form.tipo === 'trocar' && { numero_novo: form.numero_novo, numero_antigo: form.numero_antigo }),
      });
      setShowModal(false);
      setForm({ tipo: 'mapeamento', modelo: '', conta_id: '', numero_novo: '', numero_antigo: '' });
      load();
    } catch (err) { setError(err.response?.data?.detail || 'Erro ao criar tarefa'); }
    finally { setSaving(false); }
  };

  const counts = { pendente: 0, processando: 0, concluida: 0, erro: 0 };
  tarefas.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });

  const handleVerify = (t) => {
    if (!window.chrome || !window.chrome.runtime) {
      alert("Extensão não detectada. Certifique-se de que ela está instalada e ativa.");
      return;
    }

    // Oculta/mostra loading
    const rowId = `verify-btn-${t.id}`;
    const btn = document.getElementById(rowId);
    if (btn) btn.innerHTML = '<span class="animate-pulse">Verificando...</span>';

    // Dispara msg pra background.js
    const extId = process.env.REACT_APP_EXTENSION_ID || "pjdofhgeikigigocbbkefmllkldjpcch"; // default local id
    try {
      window.chrome.runtime.sendMessage(extId, {
        action: "verifyPhone",
        newPhone: t.numero_novo,
        oldPhone: t.numero_antigo,
        expectedTotal: t.resultado?.anuncios || 0
      }, (response) => {
        if (btn) btn.innerHTML = 'Verificar';
        
        if (window.chrome.runtime.lastError) {
          alert(`Erro de comunicação com a extensão: ${window.chrome.runtime.lastError.message}`);
          return;
        }
        if (response.error) {
          alert(`Erro na verificação: ${response.error}`);
          return;
        }

        // Exibe o resultado da verificação pro usuario
        let msg = `Verificação Concluída!\n\n`;
        msg += `Número Antigo (${t.numero_antigo}): Restam ${response.antigoRestantes} anúncios.\n`;
        msg += `Número Novo (${t.numero_novo}): Foram encontrados ${response.novoConfirmados} anúncios.\n`;
        
        if (response.sucessoAbsoluto) {
          msg += `\n✅ SUCESSO ABSOLUTO: Todos os anúncios foram trocados corretamente!`;
        } else {
          msg += `\n❌ ATENÇÃO: Há uma divergência.\nSe o número antigo for > 0, há anúncios presos. Se o novo for menor que o esperado, a Skokka não publicou todos.`;
        }
        alert(msg);
      });
    } catch(err) {
      if (btn) btn.innerHTML = 'Verificar';
      alert(`Falha ao iniciar verificação: ${err.message}`);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Tarefas</h1>
          <p className="text-[#64748b] text-sm mt-1">Criação e monitoramento em tempo real</p>
        </div>
        <div className="flex items-center gap-3">
          <button data-testid="btn-refresh-tasks" onClick={load}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1a2e] border border-white/5 text-[#94a3b8] hover:text-white rounded-lg text-sm transition-all">
            <ArrowsClockwise size={15} />Atualizar
          </button>
          <button data-testid="btn-create-task" onClick={() => { setShowModal(true); setError(''); }}
            className="flex items-center gap-2 bg-gradient-to-r from-[#7c3aed] to-[#ec4899] text-white font-medium rounded-lg px-5 py-2.5 hover:opacity-90 transition-opacity">
            <Plus size={16} weight="bold" />Nova Tarefa
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {Object.entries(counts).map(([status, count]) => (
          <div key={status} className={`border rounded-xl p-4 ${STATUS_CLASS[status]?.replace('animate-pulse', '')}`}>
            <div className="text-2xl font-bold">{count}</div>
            <div className="text-xs uppercase tracking-wider mt-1 opacity-70">{status}</div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a2e] border border-[#7c3aed]/20 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Lightning size={20} className="text-[#7c3aed]" />Nova Tarefa</h2>
              <button data-testid="btn-close-task" onClick={() => setShowModal(false)} className="text-[#64748b] hover:text-white"><X size={20} /></button>
            </div>
            {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm mb-4">{error}</div>}
            <form onSubmit={handleCreate} data-testid="form-tarefa" className="space-y-4">
              {/* Tipo */}
              <div>
                <label className="block text-sm text-[#94a3b8] mb-2">Tipo de Tarefa</label>
                <div className="grid grid-cols-2 gap-2">
                  {['mapeamento', 'trocar'].map(tipo => (
                    <button key={tipo} type="button" data-testid={`btn-tipo-${tipo}`}
                      onClick={() => setForm({ ...form, tipo })}
                      className={`py-2.5 rounded-lg text-sm font-medium border transition-all capitalize ${form.tipo === tipo ? 'bg-gradient-to-r from-[#7c3aed]/20 to-[#ec4899]/10 border-[#7c3aed]/40 text-white' : 'bg-[#0f0f11] border-white/10 text-[#94a3b8] hover:border-white/20'}`}>
                      {tipo === 'mapeamento' ? 'Mapeamento' : 'Trocar Números'}
                    </button>
                  ))}
                </div>
              </div>
              {/* Conta */}
              <div>
                <label className="block text-sm text-[#94a3b8] mb-2">Conta</label>
                <select data-testid="select-tarefa-conta" value={form.conta_id} onChange={e => setForm({ ...form, conta_id: e.target.value })} required
                  className="w-full bg-[#0f0f11] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-[#7c3aed] outline-none transition-all">
                  <option value="">Selecione uma conta...</option>
                  {contas.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              {/* Modelo */}
              <div>
                <label className="block text-sm text-[#94a3b8] mb-2">Modelo / Apelido</label>
                <input data-testid="input-tarefa-modelo" value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })} required
                  placeholder="Apelido da modelo" className="w-full bg-[#0f0f11] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-[#4a5568] focus:border-[#7c3aed] outline-none transition-all" />
              </div>
              {form.tipo === 'trocar' && (
                <>
                  <div>
                    <label className="block text-sm text-[#94a3b8] mb-2">Novo Número</label>
                    <input data-testid="input-tarefa-numero-novo" value={form.numero_novo} onChange={e => setForm({ ...form, numero_novo: e.target.value })} required
                      placeholder="11999998888" className="w-full bg-[#0f0f11] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-[#4a5568] focus:border-[#7c3aed] outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm text-[#94a3b8] mb-2">Número Antigo <span className="text-[#64748b]">(opcional)</span></label>
                    <input data-testid="input-tarefa-numero-antigo" value={form.numero_antigo} onChange={e => setForm({ ...form, numero_antigo: e.target.value })}
                      placeholder="11999997777" className="w-full bg-[#0f0f11] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-[#4a5568] focus:border-[#7c3aed] outline-none transition-all" />
                  </div>
                </>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 bg-[#0f0f11] border border-white/10 text-[#94a3b8] rounded-lg py-2.5 hover:border-white/20 transition-all">Cancelar</button>
                <button type="submit" data-testid="btn-submit-task" disabled={saving}
                  className="flex-1 bg-gradient-to-r from-[#7c3aed] to-[#ec4899] text-white font-medium rounded-lg py-2.5 hover:opacity-90 disabled:opacity-50 transition-all">
                  {saving ? 'Criando...' : 'Criar Tarefa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#1a1a2e] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-[#64748b]">Carregando tarefas...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="table-tarefas">
              <thead>
                <tr className="border-b border-white/5">
                  {['Tipo', 'Modelo', 'Conta', 'Líder', 'Número Novo', 'Status', 'Criado em', 'Ações'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs uppercase tracking-wider text-[#64748b]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tarefas.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-[#64748b] text-sm">Nenhuma tarefa encontrada</td></tr>
                ) : tarefas.map(t => (
                  <tr key={t.id} data-testid={`row-tarefa-${t.id}`} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${t.tipo === 'trocar' ? 'bg-[#ec4899]/10 text-[#ec4899] border-[#ec4899]/20' : 'bg-[#7c3aed]/10 text-[#a78bfa] border-[#7c3aed]/20'}`}>
                        {t.tipo === 'trocar' ? <span className="flex items-center gap-1"><ArrowSquareOut size={11} />{t.tipo}</span> : <span className="flex items-center gap-1"><Lightning size={11} />{t.tipo}</span>}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-white">{t.modelo}</td>
                    <td className="px-5 py-4 text-sm text-[#94a3b8]">{t.conta_id}</td>
                    <td className="px-5 py-4 text-sm text-[#94a3b8]">{t.lider_nome || '—'}</td>
                    <td className="px-5 py-4 text-sm text-[#94a3b8] font-mono">{t.numero_novo || '—'}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${STATUS_CLASS[t.status] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-[#64748b] whitespace-nowrap">
                      {new Date(t.created_at + (t.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                    </td>
                    <td className="px-5 py-4 text-sm whitespace-nowrap">
                      {t.tipo === 'trocar' && t.status === 'concluida' ? (
                        <button 
                          id={`verify-btn-${t.id}`}
                          onClick={() => handleVerify(t)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7c3aed]/10 text-[#a78bfa] border border-[#7c3aed]/20 rounded hover:bg-[#7c3aed]/20 transition-colors text-xs font-semibold"
                        >
                          <CheckCircle size={14} weight="bold" /> Verificar
                        </button>
                      ) : (
                        <span className="text-[#64748b] opacity-50 text-xs">—</span>
                      )}
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
