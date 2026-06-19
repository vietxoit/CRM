'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import AuthGuard from '@/components/AuthGuard';
import {
  Plus, FileText, ArrowLeft, CheckCircle2, Clock, XCircle,
  Send, Loader2, Trash2, Edit2, Mail, MessageCircle, X,
  Save, ChevronDown, Tag
} from 'lucide-react';

interface Quotation {
  id: number;
  quote_number: string;
  customer_name: string;
  company: string;
  customer_email: string;
  phone: string;
  total_value: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  created_at: string;
  valid_days: number;
  note: string;
  created_by: string;
}

interface QuoteItem {
  id?: number;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  note: string;
}

interface SteelPrice {
  id: number;
  product_name: string;
  unit: string;
  price: number;
}

const STATUS_CONFIG = {
  draft:    { label: 'Nháp',      color: 'bg-slate-100 text-slate-600 border-slate-300',      icon: <Clock size={12} /> },
  sent:     { label: 'Đã gửi',    color: 'bg-blue-50 text-blue-600 border-blue-200',           icon: <Send size={12} /> },
  accepted: { label: 'Chấp nhận', color: 'bg-emerald-50 text-emerald-700 border-emerald-200',  icon: <CheckCircle2 size={12} /> },
  rejected: { label: 'Từ chối',   color: 'bg-red-50 text-red-600 border-red-200',              icon: <XCircle size={12} /> },
};

function QuotationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterCustomerId = searchParams.get('customerId');

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [steelPrices, setSteelPrices] = useState<SteelPrice[]>([]);

  const [emailModal, setEmailModal] = useState<Quotation | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const [editModal, setEditModal] = useState<Quotation | null>(null);
  const [editItems, setEditItems] = useState<QuoteItem[]>([]);
  const [editValidDays, setEditValidDays] = useState(7);
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [zaloModal, setZaloModal] = useState<Quotation | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      const url = filterCustomerId
        ? `/api/quotations?customerId=${filterCustomerId}`
        : '/api/quotations';
      const res = await fetchWithAuth(url);
      const data = await res.json();
      if (Array.isArray(data)) setQuotations(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchSteelPrices = async () => {
    try {
      const res = await fetchWithAuth('/api/steel-prices');
      const data = await res.json();
      if (Array.isArray(data)) setSteelPrices(data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchQuotations();
    fetchSteelPrices();
  }, [filterCustomerId]);

  const handleDelete = async (id: number, quoteNumber: string) => {
    if (!confirm(`Xóa báo giá ${quoteNumber}?`)) return;
    await fetchWithAuth(`/api/quotations/${id}`, { method: 'DELETE' });
    fetchQuotations();
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    await fetchWithAuth(`/api/quotations/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    fetchQuotations();
  };

  const handleDownloadPDF = (id: number) => {
    window.open(`/api/quotations/${id}/pdf`, '_blank');
  };

  const handleSendEmail = async () => {
    if (!emailModal) return;
    try {
      setSendingEmail(true);
      const res = await fetchWithAuth(`/api/quotations/${emailModal.id}/send-email`, {
        method: 'POST',
        body: JSON.stringify({ customMessage }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Đã gửi email báo giá tới ${emailModal.customer_email}!`);
        setEmailModal(null);
        setCustomMessage('');
        fetchQuotations();
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const generateZaloText = (q: Quotation) => {
    const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' đ';
    const validUntil = new Date(q.created_at);
    validUntil.setDate(validUntil.getDate() + (q.valid_days || 7));
    return `📋 *BÁO GIÁ VẬT LIỆU THÉP - VIỆT XÔ*\n\nKính gửi: *${q.customer_name}*\n\nSố báo giá: *${q.quote_number}*\nNgày: ${new Date(q.created_at).toLocaleDateString('vi-VN')}\nHiệu lực đến: *${validUntil.toLocaleDateString('vi-VN')}*\n\n💰 Tổng giá trị: *${fmt(Number(q.total_value))}*\n_(Chưa bao gồm VAT 10%)_\n\n📎 File báo giá chi tiết đã được đính kèm.\n\nQuý khách vui lòng xem xét và phản hồi. Mọi thắc mắc xin liên hệ:\n📞 Hotline: 1800 xxxx\n\nTrân trọng,\n*${q.created_by || 'Đội kinh doanh Việt Xô'}*`;
  };

  const handleCopyZalo = async () => {
    if (!zaloModal) return;
    await navigator.clipboard.writeText(generateZaloText(zaloModal));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openEditModal = async (q: Quotation) => {
    try {
      const res = await fetchWithAuth(`/api/quotations/${q.id}`);
      const data = await res.json();
      setEditModal(q);
      setEditItems(data.items || []);
      setEditValidDays(q.valid_days || 7);
      setEditNote(q.note || '');
    } catch (err) { console.error(err); }
  };

  const handleSaveEdit = async () => {
    if (!editModal) return;
    try {
      setSaving(true);
      const res = await fetchWithAuth(`/api/quotations/${editModal.id}/edit`, {
        method: 'PUT',
        body: JSON.stringify({ items: editItems, valid_days: editValidDays, note: editNote }),
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ Đã lưu thay đổi!');
        setEditModal(null);
        fetchQuotations();
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateEditItem = (idx: number, field: keyof QuoteItem, value: any) => {
    const updated = [...editItems];
    updated[idx] = { ...updated[idx], [field]: value };
    setEditItems(updated);
  };

  const selectFromPrice = (idx: number, steelId: string) => {
    const steel = steelPrices.find(p => p.id === parseInt(steelId));
    if (!steel) return;
    const updated = [...editItems];
    updated[idx] = { ...updated[idx], product_name: steel.product_name, unit: steel.unit, unit_price: steel.price };
    setEditItems(updated);
  };

  const formatVND = (value: number) => {
    if (!value) return '0 đ';
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ đ`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)} tr đ`;
    return new Intl.NumberFormat('vi-VN').format(value) + ' đ';
  };

  const filtered = filterStatus === 'all'
    ? quotations
    : quotations.filter(q => q.status === filterStatus);

  const stats = {
    total: quotations.length,
    sent: quotations.filter(q => q.status === 'sent').length,
    accepted: quotations.filter(q => q.status === 'accepted').length,
    totalValue: quotations.filter(q => q.status === 'accepted')
      .reduce((s, q) => s + Number(q.total_value), 0),
  };

  const editTotal = editItems.reduce((s, i) =>
    s + (parseFloat(String(i.quantity)) * parseFloat(String(i.unit_price))), 0);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="animate-spin text-indigo-600" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Quản lý Báo giá</h1>
            <p className="text-sm text-slate-400 mt-1">
              {filterCustomerId ? 'Báo giá của khách hàng này' : 'Tạo và theo dõi báo giá khách hàng'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/customers')}
              className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all"
            >
              <ArrowLeft size={16} /> Quay lại CRM
            </button>

            {/* ── NÚT BẢNG GIÁ THÉP ── */}
            <button
              onClick={() => router.push('/steel-prices')}
              className="border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all"
            >
              <Tag size={16} />
              <span className="hidden sm:inline">Bảng giá thép</span>
            </button>

            <button
              onClick={() => router.push('/quotations/new')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-100 transition-all"
            >
              <Plus size={16} /> Tạo báo giá mới
            </button>
          </div>
        </div>

        {/* Thẻ thống kê */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Tổng báo giá',   value: stats.total,                color: 'text-slate-900' },
            { label: 'Đã gửi KH',       value: stats.sent,                 color: 'text-blue-600' },
            { label: 'Được chấp nhận',  value: stats.accepted,             color: 'text-emerald-600' },
            { label: 'Giá trị chốt',    value: formatVND(stats.totalValue), color: 'text-indigo-600' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{card.label}</p>
              <p className={`text-2xl font-black mt-1 ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex gap-2 flex-wrap">
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'draft', label: 'Nháp' },
            { key: 'sent', label: 'Đã gửi' },
            { key: 'accepted', label: 'Chấp nhận' },
            { key: 'rejected', label: 'Từ chối' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilterStatus(f.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filterStatus === f.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Bảng báo giá */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-4 px-6">Số báo giá</th>
                <th className="py-4 px-6">Khách hàng</th>
                <th className="py-4 px-6 text-center">Trạng thái</th>
                <th className="py-4 px-6 text-right">Giá trị</th>
                <th className="py-4 px-6 text-center">Ngày tạo</th>
                <th className="py-4 px-6 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-slate-400 text-sm italic">Chưa có báo giá nào.</td></tr>
              ) : filtered.map(q => {
                const sc = STATUS_CONFIG[q.status];
                return (
                  <tr key={q.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-6">
                      <span className="font-bold text-indigo-600 text-sm">{q.quote_number}</span>
                      <div className="text-xs text-slate-400 mt-0.5">HV: {q.valid_days} ngày</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-900 text-sm">{q.customer_name}</div>
                      <div className="text-xs text-slate-400">{q.company}</div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${sc.color}`}>
                        {sc.icon} {sc.label}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-slate-900 text-sm">
                      {formatVND(Number(q.total_value))}
                    </td>
                    <td className="py-4 px-6 text-center text-xs text-slate-500">
                      {new Date(q.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => handleDownloadPDF(q.id)} title="Xuất PDF"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                          <FileText size={15} />
                        </button>
                        <button onClick={() => { setEmailModal(q); setCustomMessage(''); }} title="Gửi email"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                          <Mail size={15} />
                        </button>
                        <button onClick={() => { setZaloModal(q); setCopied(false); }} title="Nội dung Zalo"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                          <MessageCircle size={15} />
                        </button>
                        {q.status === 'draft' && (
                          <button onClick={() => openEditModal(q)} title="Chỉnh sửa"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                            <Edit2 size={15} />
                          </button>
                        )}
                        {q.status === 'draft' && (
                          <button onClick={() => handleUpdateStatus(q.id, 'sent')} title="Đánh dấu đã gửi"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                            <Send size={15} />
                          </button>
                        )}
                        {q.status === 'sent' && (<>
                          <button onClick={() => handleUpdateStatus(q.id, 'accepted')} title="Chấp nhận"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                            <CheckCircle2 size={15} />
                          </button>
                          <button onClick={() => handleUpdateStatus(q.id, 'rejected')} title="Từ chối"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                            <XCircle size={15} />
                          </button>
                        </>)}
                        {q.status === 'draft' && (
                          <button onClick={() => handleDelete(q.id, q.quote_number)} title="Xóa"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL GỬI EMAIL */}
      {emailModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900">Gửi báo giá qua Email</h3>
                <p className="text-xs text-slate-500 mt-0.5">{emailModal.quote_number} → {emailModal.customer_email || 'Chưa có email'}</p>
              </div>
              <button onClick={() => setEmailModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {!emailModal.customer_email && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
                  ⚠️ Khách hàng này chưa có email. Vui lòng cập nhật trước khi gửi.
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Lời nhắn thêm (tuỳ chọn)</label>
                <textarea value={customMessage} onChange={e => setCustomMessage(e.target.value)} rows={4}
                  placeholder="Ví dụ: Chúng tôi đã khảo sát và đưa ra mức giá cạnh tranh nhất..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:bg-white focus:border-indigo-500 transition-all resize-none" />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 space-y-1">
                <p className="font-bold">Email sẽ bao gồm:</p>
                <p>✅ Bảng giá chi tiết từng sản phẩm</p>
                <p>✅ File PDF báo giá đính kèm</p>
                <p>✅ Thông tin hiệu lực và điều khoản</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setEmailModal(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Hủy</button>
              <button onClick={handleSendEmail} disabled={sendingEmail || !emailModal.customer_email}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
                {sendingEmail ? <><Loader2 size={14} className="animate-spin" /> Đang gửi...</> : <><Mail size={14} /> Gửi email ngay</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ZALO */}
      {zaloModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900">Nội dung nhắn Zalo</h3>
                <p className="text-xs text-slate-500 mt-0.5">Copy và paste vào Zalo cá nhân</p>
              </div>
              <button onClick={() => setZaloModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap font-mono leading-relaxed max-h-72 overflow-y-auto">
                {generateZaloText(zaloModal)}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                💡 Sau khi copy, mở Zalo → chọn khách hàng → paste nội dung → gửi kèm file PDF
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center">
              <button onClick={() => handleDownloadPDF(zaloModal.id)} className="text-sm text-indigo-600 font-semibold flex items-center gap-1.5 hover:underline">
                <FileText size={14} /> Tải PDF kèm theo
              </button>
              <div className="flex gap-3">
                <button onClick={() => setZaloModal(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Đóng</button>
                <button onClick={handleCopyZalo}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
                  {copied ? '✅ Đã copy!' : <><MessageCircle size={14} /> Copy nội dung</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHỈNH SỬA */}
      {editModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div>
                <h3 className="font-bold text-slate-900">Chỉnh sửa báo giá</h3>
                <p className="text-xs text-slate-500 mt-0.5">{editModal.quote_number}</p>
              </div>
              <button onClick={() => setEditModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hiệu lực (ngày)</label>
                  <select value={editValidDays} onChange={e => setEditValidDays(parseInt(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500">
                    <option value={3}>3 ngày</option>
                    <option value={7}>7 ngày</option>
                    <option value={14}>14 ngày</option>
                    <option value={30}>30 ngày</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ghi chú</label>
                  <input type="text" value={editNote} onChange={e => setEditNote(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500"
                    placeholder="Điều kiện giao hàng..." />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Danh sách sản phẩm</label>
                  <button onClick={() => setEditItems([...editItems, { product_name: '', unit: 'Tấn', quantity: 1, unit_price: 0, note: '' }])}
                    className="text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl flex items-center gap-1 hover:bg-indigo-100 transition-colors">
                    <Plus size={12} /> Thêm dòng
                  </button>
                </div>
                <div className="space-y-3">
                  {editItems.map((item, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500">Sản phẩm {idx + 1}</span>
                        <button onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}
                          className="text-rose-400 hover:text-rose-600"><Trash2 size={13} /></button>
                      </div>
                      <div className="relative">
                        <select onChange={e => selectFromPrice(idx, e.target.value)} defaultValue=""
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 appearance-none">
                          <option value="">-- Chọn từ bảng giá thép --</option>
                          {steelPrices.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.product_name} — {new Intl.NumberFormat('vi-VN').format(p.price)} đ/{p.unit}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-xs text-slate-500 mb-1">Tên sản phẩm</label>
                          <input type="text" value={item.product_name} onChange={e => updateEditItem(idx, 'product_name', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Số lượng</label>
                          <input type="number" min="0" step="0.1" value={item.quantity} onChange={e => updateEditItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Đơn giá (đ)</label>
                          <input type="number" min="0" step="1000" value={item.unit_price} onChange={e => updateEditItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                        </div>
                      </div>
                      <div className="text-right text-sm font-bold text-indigo-700">
                        Thành tiền: {new Intl.NumberFormat('vi-VN').format(item.quantity * item.unit_price)} đ
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <div className="text-right">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Tổng giá trị mới</p>
                  <p className="text-2xl font-black text-indigo-600 mt-1">{new Intl.NumberFormat('vi-VN').format(editTotal)} đ</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button onClick={() => setEditModal(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Hủy</button>
              <button onClick={handleSaveEdit} disabled={saving}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
                {saving ? <><Loader2 size={14} className="animate-spin" /> Đang lưu...</> : <><Save size={14} /> Lưu thay đổi</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return <AuthGuard><QuotationsPage /></AuthGuard>;
}