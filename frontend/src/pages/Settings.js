import { useState, useEffect } from 'react';
import { Copy, Check, Gear, Lightning, Globe, Key } from '@phosphor-icons/react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

function InfoCard({ label, value, copyKey, testId, mono = true }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="bg-[#0f0f11] border border-white/10 rounded-xl p-5">
      <div className="text-xs uppercase tracking-widest text-[#64748b] mb-3">{label}</div>
      <div className="flex items-center gap-3">
        <code data-testid={testId}
          className={`flex-1 text-sm ${mono ? 'font-mono' : ''} text-[#a78bfa] break-all bg-[#1a1a2e] px-3 py-2 rounded-lg border border-white/5`}>
          {value || <span className="text-[#64748b] italic">Não configurado</span>}
        </code>
        {value && (
          <button data-testid={`btn-copy-${copyKey}`} onClick={copy}
            className="flex-shrink-0 p-2.5 bg-[#7c3aed]/10 border border-[#7c3aed]/20 rounded-lg text-[#7c3aed] hover:bg-[#7c3aed]/20 transition-all">
            {copied ? <Check size={15} weight="bold" /> : <Copy size={15} />}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const [userData, setUserData] = useState(null);
  const apiUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;

  useEffect(() => {
    api.get('/api/auth/me').then(r => setUserData(r.data)).catch(() => {});
  }, []);

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Gear size={28} weight="duotone" className="text-[#7c3aed]" />
          Configurações
        </h1>
        <p className="text-[#64748b] text-sm mt-1">Integração da extensão e informações do perfil</p>
      </div>

      <div className="max-w-2xl space-y-8">
        {/* Extension connection */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Globe size={18} weight="duotone" className="text-[#7c3aed]" />
            <h2 className="text-sm font-semibold text-white">Conexão com a Extensão</h2>
          </div>
          <div className="space-y-3">
            <InfoCard label="URL da API — configure na extensão Chrome" value={apiUrl} copyKey="api-url" testId="value-api-url" />
            <div className="bg-[#1a1a2e]/60 border border-[#7c3aed]/10 rounded-xl p-4">
              <p className="text-xs text-[#64748b] leading-relaxed">
                <span className="text-[#a78bfa] font-medium">Como usar:</span> Abra a extensão SK+ PRO, na tela de login cole a URL acima no campo "URL da API" e use sua Chave de Extensão abaixo para autenticar.
              </p>
            </div>
          </div>
        </section>

        {/* Extension key */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Key size={18} weight="duotone" className="text-[#ec4899]" />
            <h2 className="text-sm font-semibold text-white">Chave de Extensão</h2>
          </div>
          <div className="space-y-3">
            <InfoCard label={`Chave de acesso — ${user?.nome}`} value={userData?.chave_extensao} copyKey="ext-key" testId="value-ext-key" />
            <p className="text-xs text-[#64748b] px-1">
              Esta chave autentica a extensão ao backend. Cole no campo "Chave de Acesso" ao fazer login na extensão. Caso perca, peça ao administrador para gerar uma nova.
            </p>
          </div>
        </section>

        {/* User info */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Lightning size={18} weight="duotone" className="text-[#7c3aed]" />
            <h2 className="text-sm font-semibold text-white">Informações do Usuário</h2>
          </div>
          <div className="bg-[#1a1a2e] border border-white/5 rounded-xl overflow-hidden">
            {[
              { label: 'Nome', value: user?.nome, testId: 'value-user-nome' },
              { label: 'Email', value: userData?.email || user?.email, testId: 'value-user-email' },
              { label: 'Função', value: user?.role, testId: 'value-user-role', badge: true },
            ].map(({ label, value, testId, badge }, i, arr) => (
              <div key={label} className={`flex items-center justify-between px-5 py-4 ${i < arr.length - 1 ? 'border-b border-white/5' : ''}`}>
                <span className="text-sm text-[#64748b]">{label}</span>
                {badge ? (
                  <span data-testid={testId} className={`px-2 py-1 rounded text-xs font-medium border ${value === 'admin' ? 'bg-[#ec4899]/10 text-[#ec4899] border-[#ec4899]/20' : 'bg-[#7c3aed]/10 text-[#a78bfa] border-[#7c3aed]/20'}`}>
                    {value}
                  </span>
                ) : (
                  <span data-testid={testId} className="text-sm text-white font-medium">{value || '—'}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
