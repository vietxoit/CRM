'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import AuthGuard from '@/components/AuthGuard';
import { Plus, Trash2, ArrowLeft, Loader2, ChevronDown } from 'lucide-react';

interface SteelPrice {
  id: number;
  product_name: string;
  unit: string;
  price: number;
  note: string;
}

interface Customer {
  id: number;
  name: string;
  company: string;
}

interface QuoteItem {
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  note: string;
}

function NewQuotationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetCustomerId = searchParams.get('customerId');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [steelPrices, setSteelPrices] = useState<SteelPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [customerId, setCustomerId] = useState(presetCustomerId || '');
  const [validDays, setValidDays] = useState(7);
  const [note, setNote] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([
    { product_name: '', unit: 'Tấn', quantity: 1, unit_price: 0, note: '' }
  ]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [cusRes, priceRes] = await Promise.all([
          fetchWithAuth('/api/customers'),
          fetchWithAuth('/api/steel-prices'),
        ]);
        const cusData = await cusRes.json();
        const priceData = await priceRes.json();
        if (Array.isArray(cusData)) setCustomers(cusData);
        if (Array.isArray(priceData)) setSteelPrices(priceData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const addItem = () => {
    setItems([...items, { product_name: '', unit: 'Tấn', quantity: 1, unit_price: 0, note: '' }]);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof QuoteItem, value: any) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  };

  // Chọn từ bảng giá thép → tự điền tên + giá
  const selectFromPriceList = (idx: number, steelId: string) => {
    const steel = steelPrices.find(p => p.id === parseInt(steelId));
    if (!steel) return;
    const updated = [...items];
    updated[idx] = {
      ...updated[idx],
      product_name: steel.product_name,
      unit: steel.unit,
      unit_price: steel.price,
    };
    setItems(updated);
  };

  const totalValue = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);

  const formatVND = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' đ';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) { alert('Vui lòng chọn khách hàng!'); return; }
    if (items.every(i => !i.product_name.trim())) { alert('Vui lòng thêm ít nhất 1 sản phẩm!'); return; }

    try {
      setSubmitting(true);
      const res = await fetchWithAuth('/api/quotations', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: parseInt(customerId),
          items: items.filter(i => i.product_name.trim()),
          valid_days: validDays,
          note,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Đã tạo báo giá ${data.quotation.quote_number}!`);
        router.push('/quotations');
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="animate-spin text-indigo-600" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Tạo báo giá mới</h1>
            <p className="text-sm text-slate-400 mt-1">Điền thông tin và chọn sản phẩm</p>
          </div>
          <button
            onClick={() => router.back()}
            className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all"
          >
            <ArrowLeft size={16} /> Quay lại
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Thông tin chung */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h2 className="font-bold text-slate-800 text-base">Thông tin báo giá</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Khách hàng *
                </label>
                <select
                  value={customerId}
                  onChange={e => setCustomerId(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:bg-white focus:border-indigo-500 transition-all text-slate-700"
                >
                  <option value="">-- Chọn khách hàng --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company ? `— ${c.company}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Hiệu lực (ngày)
                </label>
                <select
                  value={validDays}
                  onChange={e => setValidDays(parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:bg-white focus:border-indigo-500 transition-all text-slate-700"
                >
                  <option value={3}>3 ngày</option>
                  <option value={7}>7 ngày</option>
                  <option value={14}>14 ngày</option>
                  <option value={30}>30 ngày</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Ghi chú
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={2}
                placeholder="Điều kiện giao hàng, phương thức thanh toán..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:bg-white focus:border-indigo-500 transition-all text-slate-700 resize-none"
              />
            </div>
          </div>

          {/* Danh sách sản phẩm */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800 text-base">Danh sách sản phẩm</h2>
              <button
                type="button"
                onClick={addItem}
                className="text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl flex items-center gap-1 hover:bg-indigo-100 transition-colors"
              >
                <Plus size={12} /> Thêm dòng
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">Sản phẩm {idx + 1}</span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="text-rose-400 hover:text-rose-600 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Chọn từ bảng giá */}
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Chọn từ bảng giá thép</label>
                    <div className="relative">
                      <select
                        onChange={e => selectFromPriceList(idx, e.target.value)}
                        defaultValue=""
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 text-slate-700 appearance-none"
                      >
                        <option value="">-- Chọn sản phẩm từ bảng giá --</option>
                        {steelPrices.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.product_name} — {new Intl.NumberFormat('vi-VN').format(p.price)} đ/{p.unit}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs text-slate-500 mb-1">Tên sản phẩm *</label>
                      <input
                        type="text"
                        value={item.product_name}
                        onChange={e => updateItem(idx, 'product_name', e.target.value)}
                        placeholder="VD: Thép cuộn Phi 6..."
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 text-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Đơn vị</label>
                      <select
                        value={item.unit}
                        onChange={e => updateItem(idx, 'unit', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 text-slate-700"
                      >
                        <option value="Tấn">Tấn</option>
                        <option value="Kg">Kg</option>
                        <option value="Tờ">Tờ</option>
                        <option value="Cuộn">Cuộn</option>
                        <option value="Cây">Cây</option>
                        <option value="Cốc">Cốc</option>
                        <option value="Chai">Chai</option>
                        <option value="Lít">Lít</option>
                        <option value="Két">Két</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Số lượng</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 text-slate-700"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-slate-500 mb-1">Đơn giá (đ)</label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={item.unit_price}
                        onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 text-slate-700"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-slate-500 mb-1">Thành tiền</label>
                      <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-sm font-bold text-indigo-700">
                        {formatVND(item.quantity * item.unit_price)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Tổng cộng */}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Tổng giá trị</p>
                <p className="text-2xl font-black text-indigo-600 mt-1">{formatVND(totalValue)}</p>
                <p className="text-xs text-slate-400 mt-0.5">Chưa bao gồm VAT</p>
              </div>
            </div>
          </div>

          {/* Nút submit */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 flex items-center gap-2 transition-colors"
            >
              {submitting ? <><Loader2 size={16} className="animate-spin" /> Đang tạo...</> : '✅ Tạo báo giá'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Page() {
  return <AuthGuard><NewQuotationPage /></AuthGuard>;
}