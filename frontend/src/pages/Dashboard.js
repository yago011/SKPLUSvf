import { useEffect, useState } from 'react';
import { ArrowsClockwise, ArrowSquareOut, Stack, Warning, Buildings, Archive } from '@phosphor-icons/react';
import api from '../api';

const METRICS = [
  { key: 'trocas_hoje', label: 'Trocas Hoje', icon: ArrowSquareOut, color: 'pink' },
  { key: 'mapeamentos_hoje', label: 'Mapeamentos', icon: Stack, color: 'purple' },
  { key: 'tarefas_pendentes', label: 'Pendentes', icon: ArrowsClockwise, color: 'blue' },
  { key: 'tarefas_erro', label: 'Com Erro', icon: Warning, color: 'red' },
  { key: 'total_contas', label: 'Contas Ativas', icon: Buildings, color: 'green' },
  { key: 'total_modelos', label: 'Modelos', icon: Archive, color: 'purple' },
];

const COLOR_MAP = {
  pink: 'border-[#ec4899]/20 from-[#ec4899]/10',
  purple: 'border-[#7c3aed]/20 from-[#7c3aed]/10',
  blue: 'border-blue-500/20 from-blue-500/10',
  red: 'border-red-500/20 from-red-500/10',
  green: 'border-emerald-500/20 from-emerald-500/10',
};

const ICON_COLOR = {
  pink: 'text-[#ec4899]', purple: 'text-[#a78bfa]',
  blue: 'text-blue-400', red: 'text-red-400', green: 'text-emerald-400',
};

const STATUS_CLASS = {
  pendente: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  processando: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  concluida: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  erro: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [m, t] = await Promise.all([
        api.get('/api/dashboard'),
        api.get('/api/tarefas?limit=8'),
      ]);
      setMetrics(m.data);
      setTasks(t.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-[#64748b] text-sm mt-1">Visão geral do sistema SK+ PRO</p>
        </div>
        <button data-testid="btn-refresh-dashboard" onClick={load}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a1a2e] border border-white/5 text-[#94a3b8] hover:text-white hover:border-[#7c3aed]/30 rounded-lg text-sm transition-all">
          <ArrowsClockwise size={15} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {METRICS.map(({ key, label, icon: Icon, color }) => (
          <div key={key} data-testid={`metric-${key}`}
            className={`bg-gradient-to-br ${COLOR_MAP[color]} to-transparent border rounded-xl p-5 relative overflow-hidden group hover:scale-[1.02] transition-transform`}>
            <p className="text-xs uppercase tracking-wider text-[#64748b] mb-2">{label}</p>
            <p className="text-3xl font-bold text-white">{metrics !== null ? (metrics[key] ?? 0) : <span className="text-[#64748b] text-2xl">...</span>}</p>
            <Icon size={32} weight="duotone" className={`absolute bottom-3 right-3 opacity-20 group-hover:opacity-40 transition-opacity ${ICON_COLOR[color]}`} />
          </div>
        ))}
      </div>

      {/* Recent tasks */}
      <div className="bg-[#1a1a2e] border border-white/5 rounded-xl">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-semibold text-white text-sm">Tarefas Recentes</h2>
          <a href="/tarefas" className="text-xs text-[#7c3aed] hover:text-[#ec4899] transition-colors">Ver todas →</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="table-recent-tasks">
            <thead>
              <tr className="border-b border-white/5">
                {['Tipo', 'Modelo', 'Conta', 'Status', 'Criado em'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs uppercase tracking-wider text-[#64748b]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-[#64748b] text-sm">
                  {loading ? 'Carregando...' : 'Nenhuma tarefa encontrada'}
                </td></tr>
              ) : tasks.map((t) => (
                <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${t.tipo === 'trocar' ? 'bg-[#ec4899]/10 text-[#ec4899] border-[#ec4899]/20' : 'bg-[#7c3aed]/10 text-[#a78bfa] border-[#7c3aed]/20'}`}>
                      {t.tipo}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-white">{t.modelo}</td>
                  <td className="px-5 py-4 text-sm text-[#94a3b8]">{t.conta_id}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${STATUS_CLASS[t.status] || 'bg-gray-500/10 text-gray-400'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-[#64748b]">
                    {new Date(t.created_at).toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
