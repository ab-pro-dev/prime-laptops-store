import { useEffect, useMemo, useState } from 'react';
import toast from '../utils/toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const SECTION_TABS = [
  ['profile', 'Profile'],
  ['security', 'Security'],
  ['store', 'Store'],
  ['theme', 'Theme'],
  ['notifications', 'Notifications'],
  ['activity', 'Activity'],
  ['sessions', 'Sessions'],
  ['system', 'System'],
];

const defaultStore = {
  store_name: '',
  logo_url: '',
  support_email: '',
  phone: '',
  currency: 'USD',
  tax_rate: 0,
  shipping_fee: 0,
};

const defaultPrefs = {
  theme_mode: 'dark',
  email_notifications: true,
  order_notifications: true,
  stock_notifications: true,
  security_notifications: true,
};

const getError = (err, fallback) => (
  err.response?.data?.errors?.[0]?.message ||
  err.response?.data?.message ||
  fallback
);

const formatDate = (value) => value ? new Date(value).toLocaleString() : 'Never';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left hover:border-cyan/40"
      aria-pressed={checked}
    >
      <span className="font-medium text-slate-200">{label}</span>
      <span className={`relative h-6 w-11 rounded-full ${checked ? 'bg-cyan' : 'bg-white/20'}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </span>
    </button>
  );
}

export default function AdminSettings({ theme, onToggleTheme }) {
  const { user, updateUser, logout } = useAuth();
  const [tab, setTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [formError, setFormErr] = useState('');
  const [profile, setProfile] = useState({ name: '', email: '', avatar_url: '' });
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [store, setStore] = useState(defaultStore);
  const [prefs, setPrefs] = useState(defaultPrefs);
  const [activity, setActivity] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [system, setSystem] = useState(null);

  const initials = useMemo(() => (
    profile.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('') || 'A'
  ), [profile.name]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const [overview, systemRes] = await Promise.all([
        api.get('/settings'),
        api.get('/settings/system'),
      ]);

      setProfile({
        name: overview.data.profile?.name || '',
        email: overview.data.profile?.email || '',
        avatar_url: overview.data.profile?.avatar_url || '',
      });
      setStore({ ...defaultStore, ...overview.data.storeSettings });
      setPrefs({ ...defaultPrefs, ...overview.data.preferences });
      setActivity(overview.data.activity || []);
      setSessions(overview.data.sessions || []);
      setSystem(systemRes.data);
    } catch (err) {
      toast.error(getError(err, 'Failed to load settings'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const refreshActivity = async () => {
    const [activityRes, sessionsRes, systemRes] = await Promise.all([
      api.get('/settings/activity'),
      api.get('/settings/sessions'),
      api.get('/settings/system'),
    ]);
    setActivity(activityRes.data);
    setSessions(sessionsRes.data);
    setSystem(systemRes.data);
  };

  const clearFormErr = () => { if (formError) setFormErr(''); };

  const saveProfile = async (e) => {
    e.preventDefault();
    setFormErr('');
    setSaving('profile');
    try {
      const res = await api.put('/settings/profile', profile);
      setProfile({ ...res.data, avatar_url: res.data.avatar_url || '' });
      updateUser({ ...user, ...res.data });
      toast.success('Profile updated');
      await refreshActivity();
    } catch (err) {
      setFormErr(getError(err, 'Failed to update profile'));
    } finally {
      setSaving('');
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setFormErr('');
    if (passwords.new_password !== passwords.confirm_password) {
      setFormErr('New passwords do not match');
      return;
    }

    setSaving('password');
    try {
      await api.put('/settings/security/password', {
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      });
      toast.success('Password changed');
      await logout();
    } catch (err) {
      setFormErr(getError(err, 'Failed to change password'));
    } finally {
      setSaving('');
    }
  };

  const saveStore = async (e) => {
    e.preventDefault();
    setFormErr('');
    setSaving('store');
    try {
      const res = await api.put('/settings/store', store);
      setStore({ ...defaultStore, ...res.data });
      toast.success('Store settings saved');
      await refreshActivity();
    } catch (err) {
      setFormErr(getError(err, 'Failed to save store settings'));
    } finally {
      setSaving('');
    }
  };

  const savePrefs = async (nextPrefs = prefs) => {
    setFormErr('');
    setSaving('prefs');
    try {
      const res = await api.put('/settings/preferences', nextPrefs);
      setPrefs({ ...defaultPrefs, ...res.data });
      toast.success('Preferences saved');
      await refreshActivity();
    } catch (err) {
      setFormErr(getError(err, 'Failed to save preferences'));
    } finally {
      setSaving('');
    }
  };

  const selectTheme = async (mode) => {
    const nextPrefs = { ...prefs, theme_mode: mode };
    setPrefs(nextPrefs);
    if (theme !== mode) onToggleTheme();
    await savePrefs(nextPrefs);
  };

  const logoutOtherDevices = async () => {
    setSaving('sessions');
    try {
      const res = await api.delete('/settings/sessions/others');
      toast.success(`${res.data.revoked} session${res.data.revoked === 1 ? '' : 's'} logged out`);
      await refreshActivity();
    } catch (err) {
      toast.error(getError(err, 'Failed to log out other devices'));
    } finally {
      setSaving('');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="skeleton h-10 w-72" />
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="skeleton h-72" />
          <div className="skeleton h-72 md:col-span-3" />
        </div>
      </div>
    );
  }

  const ErrorBox = () => formError ? (
    <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-4 py-3">
      <p className="text-rose-300 text-sm font-medium">{formError}</p>
    </div>
  ) : null;

  const onTabClick = (key) => { setTab(key); setFormErr(''); };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold uppercase text-slate-50">Admin Settings</h1>
          <p className="text-sm text-slate-400">Profile, security, store configuration, sessions, and system status</p>
        </div>
        <div className="badge w-fit">{system?.databaseStatus || 'checking'}</div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <aside className="card h-fit p-2">
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
            {SECTION_TABS.map(([key, label]) => (
              <button
                key={key}
                onClick={() => onTabClick(key)}
                className={`rounded-lg px-4 py-3 text-left text-sm font-semibold transition-colors ${tab === key ? 'bg-cyan/15 text-cyan' : 'text-slate-400 hover:bg-white/10 hover:text-slate-100'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-5">
          {tab === 'profile' && (
            <form onSubmit={saveProfile} className="card p-6">
              <h2 className="mb-5 text-2xl font-bold uppercase">Profile</h2>
              <div className="grid gap-5 md:grid-cols-[140px_1fr]">
                <div className="flex flex-col items-center gap-3">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.name} className="h-24 w-24 rounded-full border border-white/10 object-cover" />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full border border-cyan/30 bg-cyan/10 font-display text-3xl font-bold text-cyan">{initials}</div>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Name">
                    <input className="input" value={profile.name} onChange={e => { setProfile(p => ({ ...p, name: e.target.value })); clearFormErr(); }} required />
                  </Field>
                  <Field label="Email">
                    <input className="input" type="email" value={profile.email} onChange={e => { setProfile(p => ({ ...p, email: e.target.value })); clearFormErr(); }} required />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Avatar URL">
                      <input className="input" value={profile.avatar_url || ''} onChange={e => { setProfile(p => ({ ...p, avatar_url: e.target.value })); clearFormErr(); }} placeholder="https://..." />
                    </Field>
                  </div>
                  <ErrorBox />
                  <button disabled={saving === 'profile'} className="btn-primary md:col-span-2">{saving === 'profile' ? 'Saving...' : 'Save Profile'}</button>
                </div>
              </div>
            </form>
          )}

          {tab === 'security' && (
            <form onSubmit={savePassword} className="card p-6">
              <h2 className="mb-5 text-2xl font-bold uppercase">Security</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Current Password">
                  <input className="input" type="password" value={passwords.current_password} onChange={e => { setPasswords(p => ({ ...p, current_password: e.target.value })); clearFormErr(); }} required />
                </Field>
                <Field label="New Password">
                  <input className="input" type="password" minLength={6} maxLength={12} value={passwords.new_password} onChange={e => { setPasswords(p => ({ ...p, new_password: e.target.value })); clearFormErr(); }} required />
                </Field>
                <Field label="Confirm Password">
                  <input className="input" type="password" minLength={6} maxLength={12} value={passwords.confirm_password} onChange={e => { setPasswords(p => ({ ...p, confirm_password: e.target.value })); clearFormErr(); }} required />
                </Field>
              </div>
              <ErrorBox />
              <button disabled={saving === 'password'} className="btn-primary mt-5">{saving === 'password' ? 'Updating...' : 'Change Password'}</button>
            </form>
          )}

          {tab === 'store' && (
            <form onSubmit={saveStore} className="card p-6">
              <h2 className="mb-5 text-2xl font-bold uppercase">Store Settings</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Store Name">
                  <input className="input" value={store.store_name} onChange={e => { setStore(p => ({ ...p, store_name: e.target.value })); clearFormErr(); }} required />
                </Field>
                <Field label="Logo URL">
                  <input className="input" value={store.logo_url || ''} onChange={e => { setStore(p => ({ ...p, logo_url: e.target.value })); clearFormErr(); }} placeholder="https://..." />
                </Field>
                <Field label="Support Email">
                  <input className="input" type="email" value={store.support_email} onChange={e => { setStore(p => ({ ...p, support_email: e.target.value })); clearFormErr(); }} required />
                </Field>
                <Field label="Phone">
                  <input className="input" value={store.phone || ''} onChange={e => { setStore(p => ({ ...p, phone: e.target.value })); clearFormErr(); }} />
                </Field>
                <Field label="Currency">
                  <select className="input" value={store.currency} onChange={e => setStore(p => ({ ...p, currency: e.target.value }))}>
                    {['USD', 'EUR', 'GBP', 'ETB', 'CAD'].map(code => <option key={code}>{code}</option>)}
                  </select>
                </Field>
                <Field label="Tax Rate (%)">
                  <input className="input" type="number" min="0" max="100" step="0.01" value={store.tax_rate} onChange={e => setStore(p => ({ ...p, tax_rate: e.target.value }))} />
                </Field>
                <Field label="Shipping Fee">
                  <input className="input" type="number" min="0" step="0.01" value={store.shipping_fee} onChange={e => setStore(p => ({ ...p, shipping_fee: e.target.value }))} />
                </Field>
              </div>
              <ErrorBox />
              <button disabled={saving === 'store'} className="btn-primary mt-5">{saving === 'store' ? 'Saving...' : 'Save Store Settings'}</button>
            </form>
          )}

          {tab === 'theme' && (
            <div className="card p-6">
              <h2 className="mb-5 text-2xl font-bold uppercase">Theme</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {['dark', 'light'].map(mode => (
                  <button
                    type="button"
                    key={mode}
                    onClick={() => selectTheme(mode)}
                    className={`rounded-lg border px-5 py-6 text-left font-display text-xl font-bold uppercase ${prefs.theme_mode === mode ? 'border-cyan bg-cyan/15 text-cyan' : 'border-white/10 bg-white/5 text-slate-300'}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <ErrorBox />
            </div>
          )}

          {tab === 'notifications' && (
            <div className="card p-6">
              <h2 className="mb-5 text-2xl font-bold uppercase">Notifications</h2>
              <div className="grid gap-3">
                <Toggle label="Email Notifications" checked={prefs.email_notifications} onChange={value => setPrefs(p => ({ ...p, email_notifications: value }))} />
                <Toggle label="Order Updates" checked={prefs.order_notifications} onChange={value => setPrefs(p => ({ ...p, order_notifications: value }))} />
                <Toggle label="Low Stock Alerts" checked={prefs.stock_notifications} onChange={value => setPrefs(p => ({ ...p, stock_notifications: value }))} />
                <Toggle label="Security Alerts" checked={prefs.security_notifications} onChange={value => setPrefs(p => ({ ...p, security_notifications: value }))} />
              </div>
              <ErrorBox />
              <button onClick={() => savePrefs()} disabled={saving === 'prefs'} className="btn-primary mt-5">{saving === 'prefs' ? 'Saving...' : 'Save Notifications'}</button>
            </div>
          )}

          {tab === 'activity' && (
            <div className="card overflow-x-auto">
              <div className="border-b border-white/10 p-6">
                <h2 className="text-2xl font-bold uppercase">Activity Log</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-white/[0.04]">
                  <tr>
                    {['Action', 'Time', 'IP Address'].map(h => <th key={h} className="px-4 py-3 text-left font-mono text-xs uppercase text-slate-500">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {activity.map(item => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-medium text-slate-100">{item.action}</td>
                      <td className="px-4 py-3 text-slate-400">{formatDate(item.created_at)}</td>
                      <td className="px-4 py-3 font-mono text-slate-400">{item.ip_address || 'Unknown'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'sessions' && (
            <div className="card p-6">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h2 className="text-2xl font-bold uppercase">Session Management</h2>
                <button onClick={logoutOtherDevices} disabled={saving === 'sessions'} className="btn-danger">{saving === 'sessions' ? 'Logging Out...' : 'Log Out Other Devices'}</button>
              </div>
              <div className="grid gap-3">
                {sessions.map(session => (
                  <div key={session.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium text-slate-100">{session.current ? 'Current Session' : 'Active Session'}</p>
                        <p className="max-w-2xl truncate text-sm text-slate-400">{session.user_agent || 'Unknown device'}</p>
                      </div>
                      {session.current && <span className="badge w-fit">Current</span>}
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                      <span>IP: {session.ip_address || 'Unknown'}</span>
                      <span>Last used: {formatDate(session.last_used_at)}</span>
                      <span>Expires: {formatDate(session.expires_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'system' && (
            <div className="card p-6">
              <h2 className="mb-5 text-2xl font-bold uppercase">System Info</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['App Version', system?.appVersion],
                  ['Database Status', system?.databaseStatus],
                  ['Server Time', system?.serverTime ? new Date(system.serverTime).toLocaleString() : 'Unknown'],
                  ['Uptime', `${system?.uptimeSeconds || 0}s`],
                  ['Environment', system?.nodeEnv],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                    <p className="mt-1 font-mono text-sm text-slate-100">{value || 'Unknown'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
