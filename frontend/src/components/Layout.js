import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  House, Users, Buildings, ListChecks, ClipboardText, Gear, SignOut, Lightning
} from '@phosphor-icons/react';

const NAV = [
  { path: '/', icon: House, label: 'Dashboard' },
  { path: '/tarefas', icon: ListChecks, label: 'Tarefas' },
  { path: '/logs', icon: ClipboardText, label: 'Logs' },
];

const ADMIN_NAV = [
  { path: '/users', icon: Users, label: 'Usuários' },
  { path: '/contas', icon: Buildings, label: 'Contas' },
  { path: '/settings', icon: Gear, label: 'Configurações' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const NavLink = ({ path, icon: Icon, label }) => (
    <Link
      to={path}
      data-testid={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
        isActive(path)
          ? 'bg-gradient-to-r from-[#7c3aed]/20 to-[#ec4899]/10 text-white border border-[#7c3aed]/20'
          : 'text-[#94a3b8] hover:bg-white/5 hover:text-white'
      }`}
    >
      <Icon size={18} weight={isActive(path) ? 'fill' : 'duotone'} />
      {label}
    </Link>
  );

  return (
    <div className="flex min-h-screen bg-[#0f0f11]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0f0f11] border-r border-white/5 fixed top-0 left-0 h-screen flex flex-col z-50">
        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Lightning size={24} weight="fill" className="text-[#7c3aed]" />
            <span className="text-xl font-bold bg-gradient-to-r from-[#7c3aed] to-[#ec4899] bg-clip-text text-transparent">
              SK+ PRO
            </span>
            <span className="text-xs text-[#64748b] bg-[#1a1a2e] px-2 py-0.5 rounded-full border border-white/5">v3.0</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => <NavLink key={item.path} {...item} />)}
          {user?.role === 'admin' && (
            <>
              <div className="pt-4 pb-2 px-4">
                <span className="text-xs uppercase tracking-widest text-[#64748b]">Admin</span>
              </div>
              {ADMIN_NAV.map((item) => <NavLink key={item.path} {...item} />)}
            </>
          )}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#ec4899] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {user?.nome?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white truncate">{user?.nome}</div>
              <div className="text-xs text-[#64748b] capitalize">{user?.role}</div>
            </div>
          </div>
          <button
            data-testid="btn-logout"
            onClick={() => { logout(); navigate('/login'); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#ef4444] hover:bg-red-500/10 rounded-lg transition-all"
          >
            <SignOut size={16} weight="duotone" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-64 flex-1 min-h-screen overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
