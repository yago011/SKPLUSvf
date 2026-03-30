import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeSlash, Warning, Lightning } from '@phosphor-icons/react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, senha);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao fazer login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f11] flex">
      {/* Left – branding */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden"
        style={{ background: 'radial-gradient(ellipse at center, #1a0a2e 0%, #0f0f11 70%)' }}>
        <div className="absolute inset-0 opacity-20"
          style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 50px, rgba(124,58,237,0.1) 50px, rgba(124,58,237,0.1) 51px), repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(124,58,237,0.1) 50px, rgba(124,58,237,0.1) 51px)' }}>
        </div>
        <div className="text-center relative z-10">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#ec4899] flex items-center justify-center shadow-[0_0_40px_rgba(124,58,237,0.4)]">
              <Lightning size={40} weight="fill" className="text-white" />
            </div>
          </div>
          <div className="text-6xl font-black bg-gradient-to-r from-[#7c3aed] to-[#ec4899] bg-clip-text text-transparent">SK+ PRO</div>
          <div className="text-xl font-medium text-[#94a3b8] mt-2">Plataforma SaaS v3.0</div>
          <div className="text-sm text-[#64748b] mt-4 max-w-xs mx-auto leading-relaxed">
            Automação inteligente de anúncios Skokka.<br />Controle total pelo painel web.
          </div>
        </div>
      </div>

      {/* Right – form */}
      <div className="flex-1 lg:max-w-md flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex justify-center mb-8">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#ec4899] flex items-center justify-center">
              <Lightning size={28} weight="fill" className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Bem-vindo de volta</h1>
          <p className="text-[#64748b] text-sm mb-8">Faça login para acessar o painel</p>

          <form onSubmit={handleSubmit} data-testid="login-form" className="space-y-5">
            {error && (
              <div data-testid="login-error" className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                <Warning size={16} weight="bold" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm text-[#94a3b8] mb-2">Email</label>
              <input
                type="email"
                data-testid="login-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@skplus.com.br"
                required
                className="w-full bg-[#1a1a2e] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-[#4a5568] focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm text-[#94a3b8] mb-2">Senha</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  data-testid="login-senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#1a1a2e] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-[#4a5568] focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] outline-none transition-all pr-12"
                />
                <button
                  type="button"
                  data-testid="toggle-password"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-white transition-colors"
                >
                  {showPwd ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              data-testid="login-submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#7c3aed] to-[#ec4899] text-white font-semibold rounded-lg py-3 mt-2 hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(124,58,237,0.25)]"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-xs text-[#64748b] mt-6">
            Credenciais padrão: <span className="text-[#a78bfa]">admin@skplus.com.br</span> / <span className="text-[#a78bfa]">admin123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
