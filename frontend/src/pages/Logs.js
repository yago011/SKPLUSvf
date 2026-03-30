import { useState, useEffect } from 'react';
import {
  ArrowsClockwise, MagnifyingGlass, ClipboardText, CaretDown, CaretUp,
  CheckCircle, XCircle, Warning, ArrowsLeftRight, MapPin, X,
  Phone, Tag, Buildings, User, Clock, SealWarning
} from '@phosphor-icons/react';
import api from '../api';

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseDetalhes(raw) {
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { return { raw }; }
}

const TZ = 'America/Sao_Paulo';

function formatDate(ts) {
  const d = new Date(ts);
  return {
    date: d.toLocaleDateString('pt-BR', { timeZone: TZ }),
    time: d.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    relative: (() => {
      const diff = Math.floor((Date.now() - d) / 1000);
      if (diff < 60) return `${diff}s atrás`;
      if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
      return `${Math.floor(diff / 86400)}d atrás`;
    })()
  };
}

const ACAO_META = {
  mapeamento: {
    label: 'Mapeamento',
    icon: MapPin,
    color: 'text-[#a78bfa]',
    bg: 'bg-[#7c3aed]/10 border-[#7c3aed]/20',
    dot: 'bg-[#7c3aed]',
  },
  troca_numeros: {
    label: 'Troca de Números',
    icon: ArrowsLeftRight,
    color: 'text-[#ec4899]',
    bg: 'bg-[#ec4899]/10 border-[#ec4899]/20',
    dot: 'bg-[#ec4899]',
  },
  erro: {
    label: 'Erro',
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
    dot: 'bg-red-500',
  },
};

function acaoMeta(acao = '') {
  for (const [key, val] of Object.entries(ACAO_META)) {
    if (acao.includes(key)) return val;
  }
  return { label: acao, icon: ClipboardText, color: 'text-[#94a3b8]', bg: 'bg-white/5 border-white/10', dot: 'bg-[#64748b]' };
}

// ── Metric Pill ────────────────────────────────────────────────────────────────

function Pill({ icon: Icon, label, value, color = 'text-[#94a3b8]', bg = 'bg-white/5' }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${bg} border border-white/5`}>
      {Icon && <Icon size={12} className={color} weight="fill" />}
      <span className="text-xs text-[#64748b]">{label}</span>
      <span className={`text-xs font-bold ${color}`}>{value}</span>
    </div>
  );
}

// ── Progress Bar ───────────────────────────────────────────────────────────────

function SuccessBar({ sucesso = 0, falhas = 0, verificacoes = 0 }) {
  const total = sucesso + falhas;
  if (total === 0) return null;
  const pct = Math.round((sucesso / total) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-[#64748b]">
        <span>Taxa de sucesso</span>
        <span className={`font-bold ${pct >= 90 ? 'text-emerald-400' : pct >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-emerald-400' : pct >= 70 ? 'bg-yellow-400' : 'bg-red-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {verificacoes > 0 && (
        <div className="text-xs text-[#f59e0b]">⚠ {verificacoes} verificação(ões) de segurança encontrada(s)</div>
      )}
    </div>
  );
}

// ── Detail Modal ───────────────────────────────────────────────────────────────

function LogModal({ log, onClose }) {
  const d = parseDetalhes(log.detalhes);
  const meta = acaoMeta(log.acao);
  const MetaIcon = meta.icon;
  const fmt = formatDate(log.created_at);
  const total = (d?.sucesso ?? 0) + (d?.falhas ?? 0);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[#0f0f11] border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b border-white/5 flex items-center justify-between bg-gradient-to-r ${log.acao.includes('troca') ? 'from-[#ec4899]/10' : 'from-[#7c3aed]/10'} to-transparent`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${meta.bg} border`}>
              <MetaIcon size={18} className={meta.color} weight="fill" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{meta.label}</div>
              <div className="text-xs text-[#64748b]">{fmt.date} às {fmt.time} · {fmt.relative}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-[#64748b] hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Identifiers */}
          <div className="grid grid-cols-2 gap-3">
            {log.lider_nome && (
              <div className="bg-[#1a1a2e] rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <User size={13} className="text-[#64748b]" />
                  <span className="text-xs text-[#64748b] uppercase tracking-wider">Operador</span>
                </div>
                <div className="text-sm font-medium text-white">{log.lider_nome}</div>
              </div>
            )}
            {(log.conta_id || d?.conta_id) && (
              <div className="bg-[#1a1a2e] rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <Buildings size={13} className="text-[#64748b]" />
                  <span className="text-xs text-[#64748b] uppercase tracking-wider">Conta</span>
                </div>
                <div className="text-sm font-medium text-white truncate">{log.conta_id || d?.conta_id}</div>
              </div>
            )}
            {d?.modelo && (
              <div className="bg-[#1a1a2e] rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <Tag size={13} className="text-[#64748b]" />
                  <span className="text-xs text-[#64748b] uppercase tracking-wider">Modelo</span>
                </div>
                <div className="text-sm font-medium text-white">{d.modelo}</div>
              </div>
            )}
            {d?.numero_novo && (
              <div className="bg-[#1a1a2e] rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <Phone size={13} className="text-[#64748b]" />
                  <span className="text-xs text-[#64748b] uppercase tracking-wider">Número</span>
                </div>
                <div className="text-sm font-medium text-white font-mono">
                  {d.numero_antigo && <span className="text-[#64748b] line-through mr-2">{d.numero_antigo}</span>}
                  {d.numero_novo}
                </div>
              </div>
            )}
          </div>

          {/* Operation metrics */}
          {d && (d.anuncios !== undefined || d.sucesso !== undefined) && (
            <div>
              <div className="text-xs text-[#64748b] uppercase tracking-wider mb-3">Resultado da Operação</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {d.anuncios !== undefined && (
                  <div className="bg-[#1a1a2e] rounded-xl p-3 border border-white/5 text-center">
                    <div className="text-lg font-bold text-white">{d.anuncios}</div>
                    <div className="text-xs text-[#64748b] mt-0.5">Total</div>
                  </div>
                )}
                {d.sucesso !== undefined && (
                  <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/15 text-center">
                    <div className="text-lg font-bold text-emerald-400 flex items-center justify-center gap-1">
                      <CheckCircle size={16} weight="fill" />{d.sucesso}
                    </div>
                    <div className="text-xs text-[#64748b] mt-0.5">Sucesso</div>
                  </div>
                )}
                {d.falhas !== undefined && (
                  <div className="bg-red-500/5 rounded-xl p-3 border border-red-500/15 text-center">
                    <div className="text-lg font-bold text-red-400 flex items-center justify-center gap-1">
                      <XCircle size={16} weight="fill" />{d.falhas}
                    </div>
                    <div className="text-xs text-[#64748b] mt-0.5">Falhas</div>
                  </div>
                )}
                {d.verificacoes !== undefined && d.verificacoes > 0 && (
                  <div className="bg-yellow-500/5 rounded-xl p-3 border border-yellow-500/15 text-center">
                    <div className="text-lg font-bold text-yellow-400 flex items-center justify-center gap-1">
                      <SealWarning size={16} weight="fill" />{d.verificacoes}
                    </div>
                    <div className="text-xs text-[#64748b] mt-0.5">Verificações</div>
                  </div>
                )}
                {d.recuperados !== undefined && d.recuperados > 0 && (
                  <div className="bg-blue-500/5 rounded-xl p-3 border border-blue-500/15 text-center">
                    <div className="text-lg font-bold text-blue-400">{d.recuperados}</div>
                    <div className="text-xs text-[#64748b] mt-0.5">Recuperados</div>
                  </div>
                )}
              </div>
              <SuccessBar sucesso={d.sucesso} falhas={d.falhas} verificacoes={d.verificacoes} />
            </div>
          )}

          {/* Timestamp full */}
          <div className="flex items-center gap-2 pt-1 border-t border-white/5">
            <Clock size={12} className="text-[#64748b]" />
            <span className="text-xs text-[#64748b]">{fmt.date} às {fmt.time}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Log Row ────────────────────────────────────────────────────────────────────

function LogRow({ log, onClick }) {
  const d = parseDetalhes(log.detalhes);
  const meta = acaoMeta(log.acao);
  const MetaIcon = meta.icon;
  const fmt = formatDate(log.created_at);
  const hasModal = d && Object.keys(d).length > 0;

  return (
    <div
      data-testid={`log-row-${log.id}`}
      onClick={hasModal ? onClick : undefined}
      className={`group px-5 py-4 border-b border-white/5 transition-all ${hasModal ? 'cursor-pointer hover:bg-white/[0.03]' : ''}`}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${meta.bg} border`}>
          <MetaIcon size={15} className={meta.color} weight="fill" />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${meta.bg} ${meta.color}`}>
              {meta.label}
            </span>
            {d?.modelo && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[#94a3b8] font-mono">
                {d.modelo}
              </span>
            )}
            {log.conta_id && (
              <span className="text-xs text-[#64748b]">
                <Buildings size={11} className="inline mr-1" />{log.conta_id}
              </span>
            )}
            {d?.numero_novo && (
              <span className="text-xs text-[#64748b] font-mono">
                <Phone size={11} className="inline mr-1" />
                {d.numero_antigo && <><span className="line-through">{d.numero_antigo}</span> → </>}
                <span className="text-white">{d.numero_novo}</span>
              </span>
            )}
          </div>

          {/* Metrics inline */}
          {d && (d.anuncios !== undefined || d.sucesso !== undefined) && (
            <div className="flex items-center gap-2 flex-wrap">
              {d.anuncios !== undefined && (
                <Pill icon={ClipboardText} label="anúncios" value={d.anuncios} />
              )}
              {d.sucesso !== undefined && (
                <Pill icon={CheckCircle} label="sucesso" value={d.sucesso} color="text-emerald-400" bg="bg-emerald-500/5" />
              )}
              {d.falhas !== undefined && d.falhas > 0 && (
                <Pill icon={XCircle} label="falhas" value={d.falhas} color="text-red-400" bg="bg-red-500/5" />
              )}
              {d.verificacoes !== undefined && d.verificacoes > 0 && (
                <Pill icon={Warning} label="verificações" value={d.verificacoes} color="text-yellow-400" bg="bg-yellow-500/5" />
              )}
              {d.recuperados !== undefined && d.recuperados > 0 && (
                <Pill label="recuperados" value={d.recuperados} color="text-blue-400" bg="bg-blue-500/5" />
              )}
            </div>
          )}
        </div>

        {/* Right side: time + expand hint */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0 text-right">
          <div className="text-xs font-medium text-[#64748b]">{fmt.time}</div>
          <div className="text-xs text-[#475569]">{fmt.relative}</div>
          {log.lider_nome && (
            <div className="text-xs text-[#475569]">{log.lider_nome}</div>
          )}
          {hasModal && (
            <div className="text-xs text-[#7c3aed] opacity-0 group-hover:opacity-100 transition-opacity">
              Ver detalhes →
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

const ACOES = ['mapeamento', 'troca_numeros', 'erro'];

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ acao: '' });
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (filters.acao) params.append('acao', filters.acao);
      const r = await api.get(`/api/logs?${params}`);
      setLogs(r.data);
    } finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  // summary stats
  const stats = logs.reduce((acc, l) => {
    const d = parseDetalhes(l.detalhes);
    acc.total++;
    if (l.acao.includes('mapeamento')) acc.mapeamentos++;
    if (l.acao.includes('troca')) acc.trocas++;
    if (d?.sucesso) acc.anunciosOk += d.sucesso;
    if (d?.falhas) acc.falhas += d.falhas;
    if (d?.verificacoes) acc.verificacoes += d.verificacoes;
    return acc;
  }, { total: 0, mapeamentos: 0, trocas: 0, anunciosOk: 0, falhas: 0, verificacoes: 0 });

  // group by date
  const grouped = logs.reduce((acc, l) => {
    const key = new Date(l.created_at).toLocaleDateString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
          });
    if (!acc[key]) acc[key] = [];
    acc[key].push(l);
    return acc;
  }, {});

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Logs de Atividade</h1>
          <p className="text-[#64748b] text-sm mt-1">Histórico completo de operações do sistema</p>
        </div>
        <button data-testid="btn-refresh-logs" onClick={load}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a1a2e] border border-white/5 text-[#94a3b8] hover:text-white rounded-lg text-sm transition-all">
          <ArrowsClockwise size={15} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Operações', value: stats.total, color: 'text-white', icon: ClipboardText },
          { label: 'Mapeamentos', value: stats.mapeamentos, color: 'text-[#a78bfa]', icon: MapPin },
          { label: 'Trocas', value: stats.trocas, color: 'text-[#ec4899]', icon: ArrowsLeftRight },
          { label: 'Anúncios OK', value: stats.anunciosOk, color: 'text-emerald-400', icon: CheckCircle },
          { label: 'Verificações', value: stats.verificacoes, color: 'text-yellow-400', icon: Warning },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-[#1a1a2e] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={13} className={color} weight="fill" />
              <span className="text-xs text-[#64748b]">{label}</span>
            </div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-[#1a1a2e] border border-white/5 rounded-xl p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex gap-2 flex-wrap flex-1">
            <button onClick={() => setFilters({ acao: '' })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${filters.acao === '' ? 'bg-[#7c3aed]/20 border-[#7c3aed]/30 text-[#a78bfa]' : 'bg-white/5 border-white/5 text-[#64748b] hover:text-white'}`}>
              Todos
            </button>
            {ACOES.map(a => {
              const m = acaoMeta(a);
              return (
                <button key={a} onClick={() => setFilters({ acao: a })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${filters.acao === a ? `${m.bg} ${m.color}` : 'bg-white/5 border-white/5 text-[#64748b] hover:text-white'}`}>
                  {m.label}
                </button>
              );
            })}
          </div>
          <button data-testid="btn-apply-filter" onClick={load}
            className="flex items-center gap-2 bg-gradient-to-r from-[#7c3aed] to-[#ec4899] text-white text-xs font-semibold rounded-lg px-4 py-2 hover:opacity-90 transition-opacity">
            <MagnifyingGlass size={13} weight="bold" />Filtrar
          </button>
        </div>
      </div>

      {/* Log list */}
      <div className="bg-[#1a1a2e] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-[#64748b]">Carregando logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center">
            <ClipboardText size={40} weight="duotone" className="text-[#64748b] mx-auto mb-3" />
            <p className="text-[#64748b] text-sm">Nenhum log encontrado.</p>
          </div>
        ) : (
          <>
            {Object.entries(grouped).map(([date, entries]) => (
              <div key={date}>
                <div className="px-5 py-2.5 border-b border-white/5 bg-white/[0.015] flex items-center gap-2">
                  <Clock size={12} className="text-[#64748b]" />
                  <span className="text-xs font-medium text-[#64748b] capitalize">{date}</span>
                  <span className="text-xs text-[#475569]">({entries.length} operação(ões))</span>
                </div>
                {entries.map((l, i) => (
                  <LogRow key={i} log={l} onClick={() => setSelected(l)} />
                ))}
              </div>
            ))}
            <div className="px-5 py-3 border-t border-white/5 text-xs text-[#64748b]">
              {logs.length} registro(s) — clique em uma linha para ver detalhes completos
            </div>
          </>
        )}
      </div>

      {/* Detail modal */}
      {selected && <LogModal log={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
