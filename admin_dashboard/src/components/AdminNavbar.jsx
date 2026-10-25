import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminNavbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-night/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="text-2xl">💻</span>
            <div className="flex flex-col">
              <span className="font-display text-xl font-black uppercase tracking-wider text-slate-50 leading-tight">
                Prime Laptops
              </span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-cyan">
                Admin Portal
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-white/10">
            <Link
              to="/"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === '/'
                  ? 'bg-cyan/10 text-cyan border border-cyan/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Inventory &amp; Orders
            </Link>
            <Link
              to="/settings"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === '/settings'
                  ? 'bg-cyan/10 text-cyan border border-cyan/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Settings
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://prime-laptops-store.vercel.app"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-mono text-slate-300 hover:text-cyan hover:border-cyan/40 transition-colors"
          >
            <span>Customer Store</span>
            <span>↗</span>
          </a>

          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            <div className="w-8 h-8 rounded-full bg-cyan/20 border border-cyan/40 flex items-center justify-center text-cyan font-mono text-xs font-bold uppercase">
              {user.name ? user.name[0] : 'A'}
            </div>
            <div className="hidden lg:flex flex-col">
              <span className="text-xs font-semibold text-slate-200 leading-tight">{user.name}</span>
              <span className="font-mono text-[10px] text-slate-400 leading-tight">{user.email}</span>
            </div>
            <button
              onClick={logout}
              className="ml-2 px-2.5 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
