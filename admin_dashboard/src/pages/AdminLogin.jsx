import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from '../utils/toast';

export default function AdminLogin() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const update = (key, val) => {
    setForm((p) => ({ ...p, [key]: val }));
    if (formError) setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setLoading(true);

    try {
      await login(form.email, form.password);
      toast.success('Welcome back, Admin');
      navigate('/');
    } catch (err) {
      if (!err.response) {
        setFormError(err.message || 'Unable to connect to API server.');
      } else {
        const msg = err.response.data?.message || 'Authentication failed.';
        setFormError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-night relative overflow-hidden">
      <div className="card w-full max-w-md p-8 relative z-10 border border-cyan/20 shadow-[0_0_50px_rgba(32,240,255,0.08)]">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan/10 border border-cyan/40 flex items-center justify-center text-3xl mb-3 shadow-[0_0_30px_rgba(32,240,255,0.2)]">
            🔒
          </div>
          <h1 className="font-display text-3xl font-extrabold uppercase text-slate-50 tracking-wider">
            Prime Laptops
          </h1>
          <p className="font-mono text-xs uppercase tracking-widest text-cyan font-bold mt-1">
            Admin Management Portal
          </p>
          <p className="text-slate-400 text-xs mt-2">
            Restricted access. Authorized administrator credentials required.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-300 mb-1.5">
              Admin Email
            </label>
            <input
              type="email"
              required
              placeholder="admin@primelaptops.com"
              className="input font-mono text-sm"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-300 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••••••"
              className="input font-mono text-sm"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
            />
          </div>

          {formError && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-4 py-3">
              <p className="text-rose-300 text-xs font-mono">{formError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5 text-sm"
          >
            {loading ? 'Authenticating…' : 'Enter Admin Portal'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/10 text-center">
          <a
            href="https://prime-laptops-store.vercel.app"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-mono text-slate-400 hover:text-cyan transition-colors"
          >
            ← Return to Customer Storefront
          </a>
        </div>
      </div>
    </div>
  );
}
