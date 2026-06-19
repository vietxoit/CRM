'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import AuthGuard from '@/components/AuthGuard';
import {
  ArrowLeft, Plus, Loader2, X, Save, Trash2,
  AlertTriangle, CheckCircle2, Clock, CreditCard,
  ChevronDown, ChevronUp, FileText
} from 'lucide-react';

interface Debt {
  id: number;
  customer_id: number;
  customer_name: string;
  company: string;
  title: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  due_date: string;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue';
  note: string;
  quote_number: string;
  created_at: string;
}

interface Payment {
  id: number;
  amount: number;
  paid_at: string;
  note: string;
}

interface Customer { id: number; name: string; company: string; }

interface QuoteOption {
  id: number;
  quote_number: string;
  customer_name: string;
  customer_id: number;
  company: string;
  total_value: number;
  created_at: string;
}

const STATUS_CONFIG = {
  overdue: { label: 'Quá hạn',       color: 'bg-red-50 text-red-600 border-red-200',            icon: <AlertTriangle size={12} /> },
  unpaid:  { label: 'Chưa trả',      color: 'bg-amber-50 text-amber-600 border-amber-200',       icon: <Clock size={12} /> },
  partial: { label: 'Trả một phần',  color: 'bg-blue-50 text-blue-600 border-blue-200',          icon: <CreditCard size={12} /> },
  paid:    { label: 'Đã thanh toán', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 size={12} /> },
};

function DebtsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterCustomerId = searchParams.get('customerId');

  const [debts, setDebts] = useState<Debt[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  const [addModal, setAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'manual' | 'from_quote'>('from_quote');
  const [addForm, setAddForm] = useState({
    customer_id: filterCustomerId || '',
    title: '', total_amount: '', paid_amount: '0',
    due_date: '', note: '', quotation_id: ''
  });
  const [saving, setSaving] = useState(false);
  const [quotesWithoutDebt, setQuotesWithoutDebt] = useState<QuoteOption[]>([]);

  const [payModal, setPayModal] = useState<Debt | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payForm, setPayForm] = useState({ amount: '', paid_at: new Date().toISOString().split('T')[0], note: '' });
  const [payingSaving, setPayingSaving] = useState(false);

  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchDebts = async () => {
    try {
      setLoading(true);
      const url = filterCustomerId ? `/api/debts?customerId=${filterCustomerId}` : '/api/debts';
      const res = await fetchWithAuth(url);
      const data = await res.json();
      if (Array.isArray(data)) setDebts(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetchWithAuth('/api/customers');
      const data = await res.json();
      if (Array.isArray(data)) setCustomers(data);
    } catch (err) { console.error(err); }
  };

  const fetchQuotesWithoutDebt = async () => {
    try {
      const res = await fetchWithAuth('/api/debts/from-quote');
      const data = await res.json();
      if (Array.isArray(data)) setQuotesWithoutDebt(data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchDebts();
    fetchCustomers();
  }, [filterCustomerId]);

  const openAddModal = () => {
    setAddModal(true);
    setAddMode('from_quote');
    setAddForm({
      customer_id: filterCustomerId || '',
      title: '', total_amount: '', paid_amount: '0',
      due_date: '', note: '', quotation_id: ''
    });
    fetchQuotesWithoutDebt();
  };

  const selectQuote = (quote: QuoteOption) => {
    setAddForm({
      customer_id: String(quote.customer_id),
      title: `Hợp đồng ${quote.quote_number} - ${quote.customer_name}`,
      total_amount: String(quote.total_value),
      paid_amount: '0',
      due_date: '',
      note: `Tạo từ báo giá ${quote.quote_number}`,
      quotation_id: String(quote.id),
    });
    setAddMode('manual');
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetchWithAuth('/api/debts', {
        method: 'POST',
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (data.success) {
        setAddModal(false);
        setAddForm({ customer_id: filterCustomerId || '', title: '', total_amount: '', paid_amount: '0', due_date: '', note: '', quotation_id: '' });
        fetchDebts();
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openPayModal = async (debt: Debt) => {
    setPayModal(debt);
    setPayForm({ amount: '', paid_at: new Date().toISOString().split('T')[0], note: '' });
    try {
      const res = await fetchWithAuth(`/api/debts/${debt.id}`);
      const data = await res.json();
      setPayments(data.payments || []);
    } catch (err) { console.error(err); }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModal) return;
    try {
      setPayingSaving(true);
      const res = await fetchWithAuth(`/api/debts/${payModal.id}`, {
        method: 'POST',
        body: JSON.stringify(payForm),
      });
      const data = await res.json();
      if (data.success) {
        setPayModal(null);
        fetchDebts();
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setPayingSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Xóa khoản công nợ này?')) return;
    await fetchWithAuth(`/api/debts/${id}`, { method: 'DELETE' });
    fetchDebts();
  };

  const fmt = (n: number) => {
    if (!n) return '0 đ';
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ đ`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)} tr đ`;
    return new Intl.NumberFormat('vi-VN').format(n) + ' đ';
  };

  const filtered = filterStatus === 'all' ? debts : debts.filter(d => d.status === filterStatus);

  const stats = {
    total: debts.reduce((s, d) => s + Number(d.remaining_amount), 0),
    overdue: debts.filter(d => d.status === 'overdue').reduce((s, d) => s + Number(d.remaining_amount), 0),
    unpaid: debts.filter(d => d.status === 'unpaid').length + debts.filter(d => d.status === 'partial').length,
    paid: debts.filter(d => d.status === 'paid').length,
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="animate-spin text-indigo-600" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Quản lý Công nợ</h1>
            <p className="text-sm text-slate-400 mt-1">Theo dõi công nợ và lịch sử thanh toán</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/customers')}
              className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all">
              <ArrowLeft size={16} /> Quay lại CRM
            </button>
            <button onClick={openAddModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-100 transition-all">
              <Plus size={16} /> Thêm công nợ
            </button>
          </div>
        </div>

        {/* Thống kê */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Tổng còn nợ',   value: fmt(stats.total),      color: 'text-slate-900' },
            { label: 'Quá hạn',        value: fmt(stats.overdue),    color: 'text-red-600' },
            { label: 'Chưa/Còn nợ',   value: stats.unpaid + ' KH',  color: 'text-amber-600' },
            { label: 'Đã thanh toán',  value: stats.paid + ' khoản', color: 'text-emerald-600' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{card.label}</p>
              <p className={`text-xl font-black mt-1 ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex gap-2 flex-wrap">
          {[
            { key: 'all',     label: 'Tất cả' },
            { key: 'overdue', label: '🔴 Quá hạn' },
            { key: 'unpaid',  label: 'Chưa trả' },
            { key: 'partial', label: 'Trả một phần' },
            { key: 'paid',    label: '✅ Đã trả' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilterStatus(f.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filterStatus === f.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Bảng công nợ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-4 px-6">Khách hàng / Khoản nợ</th>
                <th className="py-4 px-6 text-center">Trạng thái</th>
                <th className="py-4 px-6 text-right">Tổng nợ</th>
                <th className="py-4 px-6 text-right">Đã trả</th>
                <th className="py-4 px-6 text-right">Còn lại</th>
                <th className="py-4 px-6 text-center">Hạn trả</th>
                <th className="py-4 px-6 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400 text-sm italic">Chưa có công nợ nào.</td></tr>
              ) : filtered.map(d => {
                const sc = STATUS_CONFIG[d.status];
                const isExpanded = expandedId === d.id;
                const pct = d.total_amount > 0 ? Math.round((Number(d.paid_amount) / Number(d.total_amount)) * 100) : 0;
                return (
                  <React.Fragment key={d.id}>
                    <tr className={`hover:bg-slate-50/60 transition-colors ${d.status === 'overdue' ? 'bg-red-50/30' : ''}`}>
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-900 text-sm">{d.customer_name}</div>
                        <div className="text-xs text-slate-400">{d.company}</div>
                        <div className="text-xs text-indigo-600 font-medium mt-0.5">{d.title}</div>
                        {d.quote_number && <div className="text-xs text-slate-400">BG: {d.quote_number}</div>}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${sc.color}`}>
                          {sc.icon} {sc.label}
                        </span>
                        <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 mx-auto max-w-[80px]">
                          <div className={`h-1.5 rounded-full ${d.status === 'paid' ? 'bg-emerald-500' : d.status === 'overdue' ? 'bg-red-500' : 'bg-amber-400'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{pct}%</div>
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-slate-900 text-sm">{fmt(Number(d.total_amount))}</td>
                      <td className="py-4 px-6 text-right text-emerald-600 font-semibold text-sm">{fmt(Number(d.paid_amount))}</td>
                      <td className="py-4 px-6 text-right font-black text-sm">
                        <span className={d.status === 'paid' ? 'text-emerald-600' : 'text-red-600'}>
                          {fmt(Number(d.remaining_amount))}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className={`text-xs font-bold ${d.status === 'overdue' ? 'text-red-600' : 'text-slate-600'}`}>
                          {new Date(d.due_date).toLocaleDateString('vi-VN')}
                        </div>
                        {d.status === 'overdue' && (
                          <div className="text-[10px] text-red-500 mt-0.5">
                            Quá {Math.floor((Date.now() - new Date(d.due_date).getTime()) / 86400000)} ngày
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => setExpandedId(isExpanded ? null : d.id)} title="Xem lịch sử"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                          {d.status !== 'paid' && (
                            <button onClick={() => openPayModal(d)} title="Ghi nhận thanh toán"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                              <CreditCard size={15} />
                            </button>
                          )}
                          <button onClick={() => handleDelete(d.id)} title="Xóa"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={7} className="px-6 py-4">
                          <DebtPaymentHistory debtId={d.id} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL THÊM CÔNG NỢ ── */}
      {addModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900">Thêm khoản công nợ</h3>
              <button onClick={() => setAddModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Tab chọn chế độ */}
              <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                <button type="button" onClick={() => setAddMode('from_quote')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${addMode === 'from_quote' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  <FileText size={13} /> Từ báo giá đã chốt
                </button>
                <button type="button" onClick={() => setAddMode('manual')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${addMode === 'manual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  ✏️ Nhập thủ công
                </button>
              </div>

              {/* Tab: Từ báo giá */}
              {addMode === 'from_quote' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">Chọn báo giá đã được khách hàng chấp nhận để tạo công nợ:</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {quotesWithoutDebt.length === 0 ? (
                      <div className="text-center py-8 text-sm text-slate-400 italic border-2 border-dashed border-slate-200 rounded-xl">
                        Không có báo giá nào cần tạo công nợ.
                        <div className="text-xs mt-1">Hãy chuyển báo giá sang trạng thái "Chấp nhận" trước.</div>
                      </div>
                    ) : quotesWithoutDebt.map(q => (
                      <div key={q.id} onClick={() => selectQuote(q)}
                        className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer transition-all group">
                        <div>
                          <div className="font-bold text-sm text-indigo-600">{q.quote_number}</div>
                          <div className="text-xs text-slate-500">{q.customer_name} {q.company ? `— ${q.company}` : ''}</div>
                          <div className="text-xs text-slate-400">{new Date(q.created_at).toLocaleDateString('vi-VN')}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-sm text-slate-900">
                            {new Intl.NumberFormat('vi-VN').format(Number(q.total_value))} đ
                          </div>
                          <div className="text-xs text-indigo-500 mt-1">Bấm để chọn →</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 flex justify-end">
                    <button onClick={() => setAddModal(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Đóng</button>
                  </div>
                </div>
              )}

              {/* Tab: Nhập thủ công */}
              {addMode === 'manual' && (
                <form onSubmit={handleAdd} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Khách hàng *</label>
                    <select required value={addForm.customer_id} onChange={e => setAddForm({ ...addForm, customer_id: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500">
                      <option value="">-- Chọn khách hàng --</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.company ? `— ${c.company}` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tên khoản nợ *</label>
                    <input type="text" required value={addForm.title} onChange={e => setAddForm({ ...addForm, title: e.target.value })}
                      placeholder="VD: Hợp đồng thép tháng 6/2026"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tổng giá trị (đ) *</label>
                      <input type="number" required min="0" value={addForm.total_amount}
                        onChange={e => setAddForm({ ...addForm, total_amount: e.target.value })}
                        placeholder="VD: 150000000"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Đã trả trước (đ)</label>
                      <input type="number" min="0" value={addForm.paid_amount}
                        onChange={e => setAddForm({ ...addForm, paid_amount: e.target.value })}
                        placeholder="0"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hạn thanh toán *</label>
                    <input type="date" required value={addForm.due_date}
                      onChange={e => setAddForm({ ...addForm, due_date: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ghi chú</label>
                    <input type="text" value={addForm.note}
                      onChange={e => setAddForm({ ...addForm, note: e.target.value })}
                      placeholder="Điều khoản thanh toán..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                    <button type="button" onClick={() => setAddMode('from_quote')}
                      className="text-xs text-slate-500 hover:text-indigo-600 transition-colors">
                      ← Quay lại chọn báo giá
                    </button>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setAddModal(false)}
                        className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Hủy</button>
                      <button type="submit" disabled={saving}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold flex items-center gap-2">
                        {saving ? <><Loader2 size={14} className="animate-spin" /> Đang lưu...</> : <><Save size={14} /> Lưu công nợ</>}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL GHI NHẬN THANH TOÁN ── */}
      {payModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900">Ghi nhận thanh toán</h3>
                <p className="text-xs text-slate-500 mt-0.5">{payModal.customer_name} — {payModal.title}</p>
              </div>
              <button onClick={() => setPayModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-slate-400 font-bold">Tổng nợ</p>
                  <p className="text-sm font-black text-slate-900 mt-0.5">{fmt(Number(payModal.total_amount))}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold">Đã trả</p>
                  <p className="text-sm font-black text-emerald-600 mt-0.5">{fmt(Number(payModal.paid_amount))}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold">Còn lại</p>
                  <p className="text-sm font-black text-red-600 mt-0.5">{fmt(Number(payModal.remaining_amount))}</p>
                </div>
              </div>

              {payments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lịch sử thanh toán</p>
                  {payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs">
                      <span className="text-slate-600">{new Date(p.paid_at).toLocaleDateString('vi-VN')} {p.note && `— ${p.note}`}</span>
                      <span className="font-bold text-emerald-700">+{fmt(Number(p.amount))}</span>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddPayment} className="space-y-3 pt-2 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Thêm đợt thanh toán mới</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Số tiền (đ) *</label>
                    <input type="number" required min="0" value={payForm.amount}
                      onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                      placeholder="VD: 50000000"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Ngày thanh toán *</label>
                    <input type="date" required value={payForm.paid_at}
                      onChange={e => setPayForm({ ...payForm, paid_at: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Ghi chú</label>
                  <input type="text" value={payForm.note}
                    onChange={e => setPayForm({ ...payForm, note: e.target.value })}
                    placeholder="Chuyển khoản, tiền mặt..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setPayModal(null)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Đóng</button>
                  <button type="submit" disabled={payingSaving}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold flex items-center gap-2">
                    {payingSaving ? <><Loader2 size={14} className="animate-spin" /> Đang lưu...</> : <><CreditCard size={14} /> Ghi nhận</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DebtPaymentHistory({ debtId }: { debtId: number }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWithAuth(`/api/debts/${debtId}`)
      .then(r => r.json())
      .then(data => { setPayments(data.payments || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [debtId]);

  const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' đ';

  if (loading) return <div className="text-xs text-slate-400 py-2">Đang tải...</div>;
  if (payments.length === 0) return <div className="text-xs text-slate-400 italic py-2">Chưa có lịch sử thanh toán.</div>;

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Lịch sử thanh toán</p>
      {payments.map(p => (
        <div key={p.id} className="flex items-center justify-between bg-white border border-emerald-100 rounded-lg px-4 py-2 text-xs">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <span className="text-slate-600">{new Date(p.paid_at).toLocaleDateString('vi-VN')}</span>
            {p.note && <span className="text-slate-400">— {p.note}</span>}
          </div>
          <span className="font-bold text-emerald-700">+{fmt(Number(p.amount))}</span>
        </div>
      ))}
    </div>
  );
}

export default function Page() {
  return <AuthGuard><DebtsPage /></AuthGuard>;
}