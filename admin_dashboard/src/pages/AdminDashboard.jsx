import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import toast from '../utils/toast';

const EMPTY_FORM = { name: '', brand: '', price: '', cpu: '', ram_gb: '', storage_gb: '', storage_unit: 'GB', gpu: '', size_inches: '', stock: '', image: '', image2: '', image3: '' };

export default function AdminDashboard() {
  const [tab, setTab]           = useState('products');
  const [products, setProds]    = useState([]);
  const [orders, setOrders]     = useState([]);
  const [stats, setStats]       = useState(null);
  const [showForm, setShowF]    = useState(false);
  const [editProd, setEditP]    = useState(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [loading, setLoading]   = useState(false);
  const [formError, setFormErr] = useState('');
  const [brands, setBrands] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const fetchAll = useCallback(async () => {
    const [pRes, oRes, sRes] = await Promise.all([
      api.get('/products'),
      api.get('/orders'),
      api.get('/orders/stats'),
    ]);
    setProds(pRes.data.products ?? pRes.data);
    setOrders(oRes.data.orders ?? oRes.data);
    setStats(sRes.data);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    api.get('/products/brands').then(r => setBrands(r.data.brands)).catch(() => {});
  }, []);

  const openCreate = () => { setForm(EMPTY_FORM); setEditP(null); setShowF(true); setFormErr(''); };
  const openEdit   = (p) => {
    setForm({ ...p, price: p.price, ram_gb: p.ram_gb, storage_gb: p.storage_gb, storage_unit: p.storage_unit || 'GB', size_inches: p.size_inches, stock: p.stock, image2: p.image2 || '', image3: p.image3 || '' });
    setEditP(p); setShowF(true); setFormErr('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormErr('');
    setLoading(true);
    try {
      if (editProd) {
        await api.put(`/products/${editProd.id}`, form);
        toast.success('Product updated!');
      } else {
        await api.post('/products', form);
        toast.success('Product created!');
      }
      setShowF(false);
      await fetchAll();
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || 'Error saving product';
      setFormErr(msg);
    } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    const target = confirmDelete;
    if (!target) return;
    setConfirmDelete(null);

    const previous = products;
    setProds(prev => prev.filter(p => p.id !== target.id));

    try {
      await api.delete(`/products/${target.id}`);
      toast.success('Product deleted successfully');
    } catch (err) {
      setProds(previous);
      const msg = err.response?.data?.message || 'Failed to delete product';
      toast.error(msg);
    }
  };

  const handleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    setConfirmBulkDelete(false);
    setSelectedIds(new Set());
    setBulkDeleting(true);

    const previous = products;
    setProds(prev => prev.filter(p => !ids.includes(p.id)));

    try {
      const res = await api.delete('/products', { data: { ids } });
      toast.success(res.data.message);
      await fetchAll();
    } catch (err) {
      setProds(previous);
      const msg = err.response?.data?.message || 'Failed to delete products';
      toast.error(msg);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleStatusChange = async (orderId, status) => {
    try {
      await api.put(`/orders/${orderId}/status`, { status });
      toast.success('Order status updated');
      await fetchAll();
    } catch { toast.error('Failed to update status'); }
  };

  const statCards = stats ? [
    { label: 'Total Revenue', value: `$${stats.totalRevenue.toLocaleString()}`, icon: '💰', color: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200' },
    { label: 'Total Orders',  value: stats.totalOrders,  icon: '📦', color: 'border-cyan/20 bg-cyan/10 text-cyan' },
    { label: 'Products',      value: stats.totalProducts, icon: '💻', color: 'border-electric/20 bg-electric/15 text-sky-200' },
    { label: 'Customers',     value: stats.totalCustomers,icon: '👥', color: 'border-amber-300/20 bg-amber-400/10 text-amber-200' },
  ] : [];

  const statusColors = {
    Pending:'border-amber-300/40 bg-amber-400/10 text-amber-200',
    Processing:'border-cyan/40 bg-cyan/10 text-cyan',
    Shipped:'border-electric/40 bg-electric/15 text-sky-200',
    Delivered:'border-emerald-300/40 bg-emerald-400/10 text-emerald-200',
    Cancelled:'border-rose-400/40 bg-rose-500/10 text-rose-200'
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-display text-4xl font-extrabold uppercase text-slate-50">Admin Dashboard</h1>
          <p className="text-slate-400 text-sm">Manage products, orders, and inventory</p>
        </div>
        <Link to="/settings" className="btn-secondary">Settings</Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(s => (
          <div key={s.label} className={`card p-5 flex items-center gap-4 ${s.color}`}>
            <span className="text-2xl">{s.icon}</span>
            <div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-sm opacity-80">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-6 border-b border-white/10">
        {['products', 'orders'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors ${tab === t ? 'border-cyan text-cyan' : 'border-transparent text-slate-500 hover:text-slate-200'}`}>
            {t} {t === 'products' ? `(${products.length})` : `(${orders.length})`}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setConfirmBulkDelete(true)}
                  disabled={bulkDeleting}
                  className="btn-danger text-sm"
                >
                  Delete Selected ({selectedIds.size})
                </button>
              )}
            </div>
            <button onClick={openCreate} className="btn-primary">+ Add Product</button>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.04] border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={products.length > 0 && selectedIds.size === products.length}
                      onChange={handleSelectAll}
                      className="accent-cyan h-4 w-4 rounded border-white/20 bg-white/10"
                    />
                  </th>
                  {['Image','Name','Brand','Price','RAM','Storage','Stock','Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-mono text-xs font-semibold text-slate-500 uppercase tracking-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {products.map(p => {
                  const isNew = new Date() - new Date(p.created_at) < 28 * 24 * 60 * 60 * 1000;
                  return (
                  <tr key={p.id} className={`hover:bg-white/[0.04] ${selectedIds.has(p.id) ? 'bg-cyan/5' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => handleSelect(p.id)}
                        className="accent-cyan h-4 w-4 rounded border-white/20 bg-white/10"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <img src={p.image} alt={p.name} className="w-14 h-10 object-cover rounded" onError={e=>e.target.src='https://via.placeholder.com/56x40?text=Img'} />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-100 max-w-xs truncate">
                      {p.name}
                      {isNew && <span className="ml-2 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">NEW</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{p.brand}</td>
                    <td className="px-4 py-3 tech-price">${Number(p.price).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{p.ram_gb}GB</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{p.storage_gb} SSD</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${p.stock > 0 ? 'border-emerald-300/40 bg-emerald-400/10 text-emerald-200' : 'border-rose-400/40 bg-rose-500/10 text-rose-200'}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(p)} className="text-xs btn-secondary py-1 px-3">Edit</button>
                        <button onClick={() => setConfirmDelete(p)} className="text-xs btn-danger py-1 px-3">Delete</button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.04] border-b border-white/10">
              <tr>
                {['Order ID','Customer','Total','Status','Date','Update Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-mono text-xs font-semibold text-slate-500 uppercase tracking-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-white/[0.04]">
                  <td className="px-4 py-3 font-mono text-slate-300">#{o.id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-100">{o.customer_name || 'Unknown'}</p>
                    <p className="text-xs text-slate-500">{o.customer_email}</p>
                  </td>
                  <td className="px-4 py-3 tech-price">${Number(o.total_price).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${statusColors[o.status] || ''}`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <select value={o.status} onChange={e => handleStatusChange(o.id, e.target.value)}
                      className="rounded-lg border border-white/10 bg-panel px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan">
                      {['Pending','Processing','Shipped','Delivered','Cancelled'].map(s => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-2xl max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h2 className="font-display text-3xl font-bold uppercase text-slate-50">{editProd ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={() => setShowF(false)} className="text-slate-400 hover:text-cyan text-2xl">×</button>
            </div>
            <form onSubmit={handleSave} className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">Product Name</label>
                <input required className="input" placeholder="e.g. Dell XPS 15 9530" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Brand</label>
                <input className="input" list="brand-list" placeholder="e.g. Dell" value={form.brand} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} />
                <datalist id="brand-list">
                  {brands.map(b => <option key={b} value={b} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Price ($)</label>
                <input type="number" required min="0" step="0.01" className="input" placeholder="1299.99" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">CPU</label>
                <input required className="input" placeholder="Intel Core i7-13700H" value={form.cpu} onChange={e => setForm(p => ({ ...p, cpu: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">RAM (GB)</label>
                <input type="text" inputMode="numeric" required className="input" list="ram-options" placeholder="16" value={form.ram_gb} onChange={e => setForm(p => ({ ...p, ram_gb: e.target.value }))} />
                <datalist id="ram-options">
                  <option value="8" /><option value="16" /><option value="32" /><option value="64" /><option value="128" />
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Storage</label>
                <div className="flex gap-2">
                  <input type="text" inputMode="numeric" required className="input flex-1 min-w-0" list="storage-options" placeholder="512" value={form.storage_gb} onChange={e => setForm(p => ({ ...p, storage_gb: e.target.value }))} />
                  <datalist id="storage-options">
                    <option value="256" /><option value="512" /><option value="1" /><option value="2" /><option value="3" /><option value="4" />
                  </datalist>
                  <select className="input w-20 shrink-0" value={form.storage_unit} onChange={e => setForm(p => ({ ...p, storage_unit: e.target.value }))}>
                    <option value="GB">GB</option>
                    <option value="TB">TB</option>
                  </select>
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">GPU</label>
                <input required className="input" placeholder="NVIDIA GeForce RTX 4060" value={form.gpu} onChange={e => setForm(p => ({ ...p, gpu: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">Laptop Size (inches)</label>
                <input type="text" inputMode="decimal" required className="input" list="size-options" placeholder="e.g. 15.6" value={form.size_inches} onChange={e => setForm(p => ({ ...p, size_inches: e.target.value }))} />
                <datalist id="size-options">
                  <option value="13.3" /><option value="13.6" /><option value="14.0" /><option value="14.5" /><option value="15.3" /><option value="15.6" /><option value="16.0" /><option value="16.6" /><option value="17.3" />
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Stock</label>
                <input type="number" required min="0" className="input" placeholder="25" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">Primary Image</label>
                <input required className="input" placeholder="https://..." value={form.image} onChange={e => setForm(p => ({ ...p, image: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Secondary Image <span className="text-slate-500">(optional)</span></label>
                <input className="input" placeholder="https://..." value={form.image2} onChange={e => setForm(p => ({ ...p, image2: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Third Image <span className="text-slate-500">(optional)</span></label>
                <input className="input" placeholder="https://..." value={form.image3} onChange={e => setForm(p => ({ ...p, image3: e.target.value }))} />
              </div>

              {formError && (
                <div className="col-span-2 rounded-lg bg-rose-500/10 border border-rose-500/30 px-4 py-3">
                  <p className="text-rose-300 text-sm font-medium">{formError}</p>
                </div>
              )}

              <div className="col-span-2 flex gap-3 pt-2">
                <button type="submit" disabled={loading} className="btn-primary flex-1 py-2.5">
                  {loading ? 'Saving…' : editProd ? 'Update Product' : 'Create Product'}
                </button>
                <button type="button" onClick={() => setShowF(false)} className="btn-secondary flex-1 py-2.5">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Bulk Delete Modal */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6">
            <h2 className="font-display text-2xl font-bold uppercase text-slate-50 mb-2">Delete Products</h2>
            <p className="text-slate-300 text-sm mb-6">
              Are you sure you want to delete {selectedIds.size} products? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={handleBulkDelete} className="btn-danger flex-1 py-2.5">Confirm Delete</button>
              <button onClick={() => setConfirmBulkDelete(false)} className="btn-secondary flex-1 py-2.5">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Single Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6">
            <h2 className="font-display text-2xl font-bold uppercase text-slate-50 mb-2">Delete Product</h2>
            <p className="text-slate-300 text-sm mb-6">
              Are you sure you want to delete <span className="font-semibold text-slate-100">{confirmDelete.name}</span>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={handleDelete} className="btn-danger flex-1 py-2.5">Confirm Delete</button>
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1 py-2.5">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
