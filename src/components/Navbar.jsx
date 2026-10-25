import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import toast from '../utils/toast';
import logo from '../assets/Screenshot From 2026-06-30 13-30-57.png';

export default function Navbar({ theme, onToggleTheme }) {
  const { user, logout } = useAuth();
  const { itemCount }    = useCart();
  const navigate         = useNavigate();
  const location         = useLocation();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-night/75 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center shrink-0 group">
            <img
              src={logo}
              alt="Prime Laptops"
              className="w-40 sm:w-48 lg:w-52 h-auto object-contain transition-opacity duration-200 group-hover:opacity-80"
            />
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-400">
            <Link to="/" className={`hover:text-cyan transition-colors ${location.pathname === '/' ? 'text-cyan' : ''}`}>Home</Link>
            <Link to="/products" className={`hover:text-cyan transition-colors ${location.pathname.startsWith('/products') ? 'text-cyan' : ''}`}>Shop</Link>
            {user?.role === 'admin' && (
              <a
                href="https://prime-laptops-store-admin-dashboard.onrender.com"
                target="_blank"
                rel="noreferrer"
                className="text-cyan hover:underline flex items-center gap-1 font-mono text-xs uppercase"
              >
                Admin Portal ↗
              </a>
            )}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link to="/cart" className={`relative p-2 text-slate-300 hover:text-cyan transition-colors ${location.pathname.startsWith('/cart') ? 'text-cyan' : ''}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                  </svg>
                  {itemCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-cyan text-night text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {itemCount}
                    </span>
                  )}
                </Link>
                <Link to="/orders" className={`text-sm text-slate-400 hover:text-cyan transition-colors hidden sm:block ${location.pathname.startsWith('/orders') ? 'text-cyan' : ''}`}>
                  Orders
                </Link>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500 hidden sm:block">Hi, {user.name.split(' ')[0]}</span>
                  <button onClick={handleLogout} className="btn-secondary text-sm py-1.5 px-3">
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="btn-secondary text-sm py-1.5 px-4">Login</Link>
                <Link to="/register" className="btn-primary text-sm py-1.5 px-4">Register</Link>
              </div>
            )}
            <button
              type="button"
              onClick={onToggleTheme}
              className="theme-toggle"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-pressed={theme === 'light'}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <span className="sr-only">Toggle color theme</span>
              {theme === 'dark' ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path strokeLinecap="round" d="M12 2.5v2.2M12 19.3v2.2M4.58 4.58l1.55 1.55M17.87 17.87l1.55 1.55M2.5 12h2.2M19.3 12h2.2M4.58 19.42l1.55-1.55M17.87 6.13l1.55-1.55" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 14.5A8.5 8.5 0 119.5 3 6.8 6.8 0 0021 14.5z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
