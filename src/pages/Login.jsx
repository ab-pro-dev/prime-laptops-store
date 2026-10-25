import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from '../utils/toast';

const ERROR_MAP = {
  404: 'No account found with this email.',
  401: 'Incorrect password. Please try again.',
  429: 'Too many attempts. Please wait a few minutes.',
};

export default function Login() {
  const [form, setForm]         = useState({ email: '', password: '' });
  const [loading, setL]         = useState(false);
  const [formError, setFormErr] = useState('');
  const [fieldErr, setFieldErr] = useState({ email: '', password: '' });
  const { login }               = useAuth();
  const navigate                = useNavigate();

  const update = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    if (fieldErr[key]) setFieldErr(p => ({ ...p, [key]: '' }));
    if (formError) setFormErr('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErr('');
    setFieldErr({ email: '', password: '' });

    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      setFieldErr(p => ({ ...p, email: 'Please enter a valid email address' }));
      return;
    }

    setL(true);
    try {
      const user = await login(form.email, form.password);
      toast.success('Logged in successfully');
      if (user.role === 'admin') {
        window.location.href = 'https://prime-laptops-store-admin-dashboard.onrender.com';
      } else {
        navigate('/');
      }
    } catch (err) {
      if (!err.response) {
        setFormErr('Unable to connect. Please check your connection.');
      } else {
        const status = err.response.status;
        const msg = ERROR_MAP[status];
        if (msg) {
          if (status === 404) setFieldErr(p => ({ ...p, email: msg }));
          else if (status === 401) setFieldErr(p => ({ ...p, password: msg }));
          else setFormErr(msg);
        } else {
          setFormErr(err.response?.data?.message || 'Login failed');
        }
      }
    } finally { setL(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="card w-full max-w-md p-8">
        <div className="text-center mb-8">
          <span className="text-4xl">💻</span>
          <h1 className="font-display text-4xl font-extrabold uppercase text-slate-50 mt-2">Sign in to Prime Laptops</h1>
          <p className="text-slate-400 text-sm mt-1">Welcome back!</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input type="email" required className={`input ${fieldErr.email ? 'border-rose-500 ring-2 ring-rose-500/20' : ''}`}
              value={form.email} onChange={e => update('email', e.target.value)} />
            {fieldErr.email && <p className="text-rose-400 text-xs mt-1">{fieldErr.email}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input type="password" required className={`input ${fieldErr.password ? 'border-rose-500 ring-2 ring-rose-500/20' : ''}`}
              value={form.password} onChange={e => update('password', e.target.value)} />
            {fieldErr.password && <p className="text-rose-400 text-xs mt-1">{fieldErr.password}</p>}
          </div>

          {formError && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-4 py-3">
              <p className="text-rose-300 text-sm font-medium">{formError}</p>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-cyan font-semibold hover:underline">Create one</Link>
        </p>
      </div>
    </div>
  );
}
