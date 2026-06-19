'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import AuthGuard from '@/components/AuthGuard';
import {
  ArrowLeft, Plus, Edit2, Trash2, Save, X, Loader2, RefreshCw
} from 'lucide-react';

interface SteelPrice {
  id: number;
  product_name: string;
  unit: string;
  price: number;
  note: string;
  updated_at: string;
}

function SteelPricesPage() {
  const router = useRouter();
  const [prices, setPrices] = useState<SteelPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form thêm mới
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({
    product_name: '', unit: 'Tấn', price: '', note: ''
  });

  // Inline edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState({ price: '', note: '' });

  const fetchPrices = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth('/api/steel-prices');
      const data = await res.json();
      if (Array.isArray(data)) setPrices(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPrices(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.product_name.trim() || !newItem.price) {
      alert('Vui lòng điền tên sản phẩm và giá!');
      return;
    }
    try {
      setSaving(true);
      const res = await fetchWithAuth('/api/steel-prices', {
        method: 'POST',
        body: JSON.stringify({
          product_name: newItem.product_name.trim(),
          unit: newItem.unit,
          price: parseFloat(newItem.price),
          note: newItem.note,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewItem({ product_name: '', unit: 'Tấn', price: '', note: '' });
        setShowAddForm(false);
        fetchPrices();
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (id: number) => {
    try {
      setSaving(true);
      const res = await fetchWithAuth('/api/steel-prices', {
        method: 'PUT',
        body: JSON.stringify({
          id,
          price: parseFloat(editData.price),
          note: editData.note,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingId(null);
        fetchPrices();
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Xóa "${name}" khỏi bảng giá?`)) return;
    try {
      const res = await fetchWithAuth('/api/steel-prices', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) fetchPrices();
      else alert('Lỗi: ' + data.error);
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    }
  };

  const startEdit = (p: SteelPrice) => {
    setEditingId(p.id);
    setEditData({ price: String(p.price), note: p.note || '' });
  };

  const formatVND = (n: number) =>
    new Intl.NumberFormat('vi-VN').format(n) + ' đ';

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="animate-spin text-indigo-600" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Bảng giá thép</h1>
            <p className="text-sm text-slate-400 mt-1">
              Quản lý giá sản phẩm — tự động điền vào báo giá
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/quotations')}
              className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all"
            >
              <ArrowLeft size={16} /> Quay lại Báo giá
            </button>
            <button
              onClick={fetchPrices}
              className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-semibold px-3 py-2.5 rounded-xl flex items-center gap-2 transition-all"
              title="Làm mới"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-100 transition-all"
            >
              <Plus size={16} /> Thêm sản phẩm
            </button>
          </div>
        </div>

        {/* Form thêm mới */}
        {showAddForm && (
          <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Thêm sản phẩm mới</h2>
              <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Tên sản phẩm *
                </label>
                <input
                  type="text"
                  required
                  value={newItem.product_name}
                  onChange={e => setNewItem({ ...newItem, product_name: e.target.value })}
                  placeholder="VD: Thép cuộn CB240T Phi 6"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:bg-white focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Đơn vị
                </label>
                <select
                  value={newItem.unit}
                  onChange={e => setNewItem({ ...newItem, unit: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:bg-white focus:border-indigo-500 transition-all"
                >
                  <option value="Tấn">Tấn</option>
                  <option value="Kg">Kg</option>
                  <option value="Tờ">Tờ</option>
                  <option value="Cuộn">Cuộn</option>
                  <option value="Cây">Cây</option>
                  <option value="m2">m²</option>
                  <option value="Cốc">Cốc</option>
                  <option value="Chai">Chai</option>
                  <option value="Lít">Lít</option>
                  <option value="Két">Két</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Đơn giá (đ) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="1000"
                  value={newItem.price}
                  onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                  placeholder="VD: 15500000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:bg-white focus:border-indigo-500 transition-all"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Ghi chú
                </label>
                <input
                  type="text"
                  value={newItem.note}
                  onChange={e => setNewItem({ ...newItem, note: e.target.value })}
                  placeholder="VD: Việt Xô sản xuất, Nhập khẩu..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:bg-white focus:border-indigo-500 transition-all"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Thêm
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Bảng giá */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">{prices.length} sản phẩm</span>
            <span className="text-xs text-slate-400">Cập nhật lần cuối: {prices[0] ? formatDate(prices[0].updated_at) : '—'}</span>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-3 px-6">Tên sản phẩm</th>
                <th className="py-3 px-6 text-center">ĐVT</th>
                <th className="py-3 px-6 text-right">Đơn giá</th>
                <th className="py-3 px-6">Ghi chú</th>
                <th className="py-3 px-6 text-center">Cập nhật</th>
                <th className="py-3 px-6 text-center w-24">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {prices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-sm italic">
                    Chưa có sản phẩm nào. Bấm "Thêm sản phẩm" để bắt đầu!
                  </td>
                </tr>
              ) : prices.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-6 font-semibold text-slate-900 text-sm">{p.product_name}</td>
                  <td className="py-3.5 px-6 text-center text-sm text-slate-600">{p.unit}</td>
                  <td className="py-3.5 px-6 text-right">
                    {editingId === p.id ? (
                      <input
                        type="number"
                        value={editData.price}
                        onChange={e => setEditData({ ...editData, price: e.target.value })}
                        className="w-36 bg-white border border-indigo-300 rounded-lg px-2 py-1 text-sm text-right outline-none focus:ring-2 focus:ring-indigo-500/20"
                        step="1000"
                      />
                    ) : (
                      <span className="font-bold text-indigo-700 text-sm">{formatVND(p.price)}</span>
                    )}
                  </td>
                  <td className="py-3.5 px-6 text-sm text-slate-500">
                    {editingId === p.id ? (
                      <input
                        type="text"
                        value={editData.note}
                        onChange={e => setEditData({ ...editData, note: e.target.value })}
                        className="w-full bg-white border border-indigo-300 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                        placeholder="Ghi chú..."
                      />
                    ) : (
                      <span className="text-slate-400">{p.note || '—'}</span>
                    )}
                  </td>
                  <td className="py-3.5 px-6 text-center text-xs text-slate-400">
                    {formatDate(p.updated_at)}
                  </td>
                  <td className="py-3.5 px-6">
                    <div className="flex items-center justify-center gap-1.5">
                      {editingId === p.id ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(p.id)}
                            disabled={saving}
                            title="Lưu"
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-60"
                          >
                            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            title="Hủy"
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
                          >
                            <X size={15} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(p)}
                            title="Sửa giá"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.product_name)}
                            title="Xóa"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Ghi chú */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          💡 Giá trong bảng này sẽ tự động điền vào form tạo báo giá khi nhân viên chọn sản phẩm.
          Cập nhật giá thường xuyên để đảm bảo báo giá luôn chính xác!
        </div>

      </div>
    </div>
  );
}

export default function Page() {
  return <AuthGuard><SteelPricesPage /></AuthGuard>;
}