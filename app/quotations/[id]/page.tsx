'use client';

import React, { useState, useEffect, use as useReact } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, FileText, Mail, MessageCircle, CheckCircle2,
  XCircle, Send, Clock, Loader2, X, Edit2, Plus, Trash2,
  Save, ChevronDown, Building2, Phone
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import AuthGuard from '@/components/AuthGuard';

interface QuotationDetail {
  id: number;
  quote_number: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  valid_days: number;
  note: string;
  total_value: number;
  created_by: string;
  created_at: string;
  sent_at: string | null;
  customer_name: string;
  company: string;
  phone: string;
  customer_email: string;
  items: QuoteItem[];
}

interface QuoteItem {
  id: number;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  note: string;
}

interface SteelPrice {
  id: number;
  product_name: string;
  unit: string;
  price: number;
}

const STATUS_CONFIG = {
  draft:    { label: 'Nháp',      color: 'bg-slate-100 text-slate-600 border-slate-300',          icon: <Clock size={14} /> },
  sent:     { label: 'Đã gửi',    color: 'bg-blue-50 text-blue-600 border-blue-200',               icon: <Send size={14} /> },
  accepted: { label: 'Chấp nhận', color: 'bg-emerald-50 text-emerald-700 border-emerald-200',      icon: <CheckCircle2 size={14} /> },
  rejected: { label: 'Từ chối',   color: 'bg-red-50 text-red-600 border-red-200',                  icon: <XCircle size={14} /> },
};

function QuotationDetailPage({ params }: { params: any }) {
  const resolvedParams = useReact(params) as { id: string };
  const idRaw = resolvedParams.id;
  const router = useRouter();
  const id = Number(idRaw);

  const [quotation, setQuotation] = useState<QuotationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [steelPrices, setSteelPrices] = useState<SteelPrice[]>([]);

  // Email modal
  const [emailModal, setEmailModal] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Zalo modal
  const [zaloModal, setZaloModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Edit modal
  const [editModal, setEditModal] = useState(false);
  const [editItems, setEditItems] = useState<QuoteItem[]>([]);
  const [editValidDays, setEditValidDays] = useState(7);
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchQuotation = async () => {
    try {
      const res = await fetchWithAuth(`/api/quotations/${id}`);
      if (res.ok) setQuotation(await res.json());
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
    fetchQuotation();
    fetchSteelPrices();
  }, [id]);

  const handleUpdateStatus = async (status: string) => {
    try {
      await fetchWithAuth(`/api/quotations/${id}`, {
        method: 'PUT', body: JSON.stringify({ status }),
      });
      fetchQuotation();
    } catch (err) { console.error(err); }
  };

  const handleDownloadPDF = () => window.open(`/api/quotations/${id}/pdf`, '_blank');

  const handleSendEmail = async () => {
    if (!quotation?.customer_email) { alert('Khách hàng chưa có email!'); return; }
    try {
      setSendingEmail(true);
      const res = await fetchWithAuth(`/api/quotations/${id}/send-email`, {
        method: 'POST', body: JSON.stringify({ customMessage }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Đã gửi email tới ${quotation.customer_email}!`);
        setEmailModal(false);
        setCustomMessage('');
        fetchQuotation();
      } else { alert('Lỗi: ' + data.error); }
    } finally { setSendingEmail(false); }
  };

  const generateZaloText = () => {
    if (!quotation) return '';
    const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' đ';
    const validUntil = new Date(quotation.created_at);
    validUntil.setDate(validUntil.getDate() + (quotation.valid_days || 7));
    return `📋 *BÁO GIÁ VẬT LIỆU THÉP - VIỆT XÔ*\n\nKính gửi: *${quotation.customer_name}*\n\nSố báo giá: *${quotation.quote_number}*\nNgày: ${new Date(quotation.created_at).toLocaleDateString('vi-VN')}\nHiệu lực đến: *${validUntil.toLocaleDateString('vi-VN')}*\n\n💰 Tổng giá trị: *${fmt(Number(quotation.total_value))}*\n_(Chưa bao gồm VAT 10%)_\n\n📎 File báo giá chi tiết đã được đính kèm.\n\nQuý khách vui lòng xem xét và phản hồi. Mọi thắc mắc xin liên hệ:\n📞 Hotline: 1800 xxxx\n\nTrân trọng,\n*${quotation.created_by || 'Đội kinh doanh Việt Xô'}*`;
  };

  const handleCopyZalo = async () => {
    await navigator.clipboard.writeText(generateZaloText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openEditModal = () => {
    if (!quotation) return;
    setEditItems(quotation.items || []);
    setEditValidDays(quotation.valid_days || 7);
    setEditNote(quotation.note || '');
    setEditModal(true);
  };

  const handleSaveEdit = async () => {
    try {
      setSaving(true);
      const res = await fetchWithAuth(`/api/quotations/${id}/edit`, {
        method: 'PUT',
        body: JSON.stringify({ items: editItems, valid_days: editValidDays, note: editNote }),
      });
      const data = await res.json();
      if (data.success) { setEditModal(false); fetchQuotation(); }
      else { alert('Lỗi: ' + data.error); }
    } finally { setSaving(false); }
  };

  const selectFromPrice = (idx: number, steelId: string) => {
    const steel = steelPrices.find(p => p.id === parseInt(steelId));
    if (!steel) return;
    const updated = [...editItems];
    updated[idx] = { ...updated[idx], product_name: steel.product_name, unit: steel.unit, unit_price: steel.price };
    setEditItems(updated);
  };

  const fmt = (n: number) => {
    if (!n) return '0 đ';
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ đ`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)} tr đ`;
    return new Intl.NumberFormat('vi-VN').format(n) + ' đ';
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="animate-spin text-indigo-600" size={32} />
    </div>
  );

  if (!quotation) return (
    <div className="p-8 text-center text-red-500 font-bold">Không tìm thấy báo giá.</div>
  );

  const sc = STATUS_CONFIG[quotation.status];
  const validUntil = new Date(quotation.created_at);
  validUntil.setDate(validUntil.getDate() + (quotation.valid_days || 7));
  const editTotal = editItems.reduce((s, i) => s + (parseFloat(String(i.quantity)) * parseFloat(String(i.unit_price))), 0);

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button onClick={() => router.back()}
            className="flex items-center gap-2 text-sm font-bold text-slate-600 border border-slate-200 bg-white px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors">
            <ArrowLeft size={16} /> Quay lại
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Xuất PDF */}
            <button onClick={handleDownloadPDF}
              className="flex items-center gap-2 text-sm font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors">
              <FileText size={15} /> Xuất PDF
            </button>
            {/* Gửi Email */}
            <button onClick={() => setEmailModal(true)}
              className="flex items-center gap-2 text-sm font-semibold border border-blue-200 bg-blue-50 text-blue-700 px-4 py-2 rounded-xl hover:bg-blue-100 transition-colors">
              <Mail size={15} /> Gửi Email
            </button>
            {/* Zalo */}
            <button onClick={() => setZaloModal(true)}
              className="flex items-center gap-2 text-sm font-semibold border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl hover:bg-emerald-100 transition-colors">
              <MessageCircle size={15} /> Zalo
            </button>
            {/* Sửa — chỉ khi draft */}
            {quotation.status === 'draft' && (
              <button onClick={openEditModal}
                className="flex items-center gap-2 text-sm font-semibold border border-amber-200 bg-amber-50 text-amber-700 px-4 py-2 rounded-xl hover:bg-amber-100 transition-colors">
                <Edit2 size={15} /> Chỉnh sửa
              </button>
            )}
          </div>
        </div>

        {/* Card thông tin báo giá */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header màu */}
          <div className="bg-indigo-600 px-6 py-5 flex items-start justify-between">
            <div>
              <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-1">Báo giá vật liệu thép</p>
              <h1 className="text-2xl font-black text-white">{quotation.quote_number}</h1>
              <p className="text-indigo-200 text-sm mt-1">Tạo bởi: {quotation.created_by}</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full border ${sc.color}`}>
              {sc.icon} {sc.label}
            </span>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Thông tin KH */}
            <div className="space-y-2">
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Kính gửi</p>
              <p className="font-black text-slate-900 text-lg">{quotation.customer_name}</p>
              {quotation.company && <p className="text-sm text-slate-500 flex items-center gap-1.5"><Building2 size={13} /> {quotation.company}</p>}
              {quotation.phone && <p className="text-sm text-slate-500 flex items-center gap-1.5"><Phone size={13} /> {quotation.phone}</p>}
              {quotation.customer_email && <p className="text-sm text-slate-500 flex items-center gap-1.5"><Mail size={13} /> {quotation.customer_email}</p>}
            </div>

            {/* Thông tin báo giá */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Ngày phát hành</span>
                <span className="font-semibold">{new Date(quotation.created_at).toLocaleDateString('vi-VN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Hiệu lực đến</span>
                <span className="font-semibold text-red-600">{validUntil.toLocaleDateString('vi-VN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Thời hạn</span>
                <span className="font-semibold">{quotation.valid_days} ngày</span>
              </div>
              {quotation.sent_at && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Đã gửi lúc</span>
                  <span className="font-semibold">{new Date(quotation.sent_at).toLocaleDateString('vi-VN')}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex justify-between">
                <span className="text-slate-500 font-bold">Tổng giá trị</span>
                <span className="font-black text-indigo-600 text-base">{fmt(Number(quotation.total_value))}</span>
              </div>
            </div>
          </div>

          {quotation.note && (
            <div className="px-6 pb-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                📝 <span className="font-semibold">Ghi chú:</span> {quotation.note}
              </div>
            </div>
          )}
        </div>

        {/* Bảng sản phẩm */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-900">Danh sách sản phẩm</h2>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-3">STT</th>
                <th className="px-6 py-3">Tên sản phẩm</th>
                <th className="px-6 py-3 text-center">ĐVT</th>
                <th className="px-6 py-3 text-right">Số lượng</th>
                <th className="px-6 py-3 text-right">Đơn giá</th>
                <th className="px-6 py-3 text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(quotation.items || []).length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400 italic text-sm">Chưa có sản phẩm.</td></tr>
              ) : (quotation.items || []).map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3 text-sm text-slate-400">{idx + 1}</td>
                  <td className="px-6 py-3 font-semibold text-slate-900 text-sm">{item.product_name}</td>
                  <td className="px-6 py-3 text-center text-sm text-slate-500">{item.unit}</td>
                  <td className="px-6 py-3 text-right text-sm">{new Intl.NumberFormat('vi-VN').format(item.quantity)}</td>
                  <td className="px-6 py-3 text-right text-sm">{new Intl.NumberFormat('vi-VN').format(item.unit_price)} đ</td>
                  <td className="px-6 py-3 text-right font-black text-slate-900 text-sm">{fmt(Number(item.quantity) * Number(item.unit_price))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-indigo-50 border-t-2 border-indigo-100">
                <td colSpan={5} className="px-6 py-4 text-right font-black text-indigo-700">TỔNG CỘNG (chưa VAT):</td>
                <td className="px-6 py-4 text-right font-black text-indigo-700 text-lg">{fmt(Number(quotation.total_value))}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Nút cập nhật trạng thái */}
        {quotation.status !== 'accepted' && quotation.status !== 'rejected' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="font-bold text-slate-800 text-sm">Cập nhật trạng thái</p>
              <p className="text-xs text-slate-400 mt-0.5">Thay đổi tiến trình xử lý báo giá này</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {quotation.status === 'draft' && (
                <button onClick={() => handleUpdateStatus('sent')}
                  className="flex items-center gap-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-colors">
                  <Send size={14} /> Đánh dấu đã gửi
                </button>
              )}
              {quotation.status === 'sent' && (<>
                <button onClick={() => handleUpdateStatus('accepted')}
                  className="flex items-center gap-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-colors">
                  <CheckCircle2 size={14} /> Khách chấp nhận
                </button>
                <button onClick={() => handleUpdateStatus('rejected')}
                  className="flex items-center gap-2 text-sm font-bold bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl transition-colors">
                  <XCircle size={14} /> Khách từ chối
                </button>
              </>)}
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL GỬI EMAIL ── */}
      {emailModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900">Gửi báo giá qua Email</h3>
                <p className="text-xs text-slate-500 mt-0.5">{quotation.quote_number} → {quotation.customer_email || 'Chưa có email'}</p>
              </div>
              <button onClick={() => setEmailModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {!quotation.customer_email && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
                  ⚠️ Khách hàng chưa có email. Vui lòng cập nhật trước khi gửi.
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Lời nhắn thêm (tuỳ chọn)</label>
                <textarea value={customMessage} onChange={e => setCustomMessage(e.target.value)} rows={4}
                  placeholder="Ví dụ: Chúng tôi đã khảo sát và đưa ra mức giá cạnh tranh nhất..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:bg-white focus:border-indigo-500 resize-none" />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 space-y-1">
                <p className="font-bold">Email sẽ bao gồm:</p>
                <p>✅ Bảng giá chi tiết từng sản phẩm</p>
                <p>✅ File PDF báo giá đính kèm</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setEmailModal(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Hủy</button>
              <button onClick={handleSendEmail} disabled={sendingEmail || !quotation.customer_email}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold flex items-center gap-2">
                {sendingEmail ? <><Loader2 size={14} className="animate-spin" /> Đang gửi...</> : <><Mail size={14} /> Gửi email ngay</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ZALO ── */}
      {zaloModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900">Nội dung nhắn Zalo</h3>
                <p className="text-xs text-slate-500 mt-0.5">Copy và paste vào Zalo cá nhân</p>
              </div>
              <button onClick={() => setZaloModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap font-mono leading-relaxed max-h-72 overflow-y-auto">
                {generateZaloText()}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                💡 Sau khi copy, mở Zalo → chọn khách hàng → paste → gửi kèm file PDF
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center">
              <button onClick={handleDownloadPDF} className="text-sm text-indigo-600 font-semibold flex items-center gap-1.5 hover:underline">
                <FileText size={14} /> Tải PDF kèm theo
              </button>
              <div className="flex gap-3">
                <button onClick={() => setZaloModal(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Đóng</button>
                <button onClick={handleCopyZalo}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center gap-2">
                  {copied ? '✅ Đã copy!' : <><MessageCircle size={14} /> Copy nội dung</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CHỈNH SỬA ── */}
      {editModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div>
                <h3 className="font-bold text-slate-900">Chỉnh sửa báo giá</h3>
                <p className="text-xs text-slate-500 mt-0.5">{quotation.quote_number}</p>
              </div>
              <button onClick={() => setEditModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
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
                  <button onClick={() => setEditItems([...editItems, { id: 0, product_name: '', unit: 'Tấn', quantity: 1, unit_price: 0, total_price: 0, note: '' }])}
                    className="text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl flex items-center gap-1">
                    <Plus size={12} /> Thêm dòng
                  </button>
                </div>
                <div className="space-y-3">
                  {editItems.map((item, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500">Sản phẩm {idx + 1}</span>
                        <button onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))} className="text-rose-400 hover:text-rose-600"><Trash2 size={13} /></button>
                      </div>
                      <div className="relative">
                        <select onChange={e => selectFromPrice(idx, e.target.value)} defaultValue=""
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 appearance-none">
                          <option value="">-- Chọn từ bảng giá thép --</option>
                          {steelPrices.map(p => (
                            <option key={p.id} value={p.id}>{p.product_name} — {new Intl.NumberFormat('vi-VN').format(p.price)} đ/{p.unit}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-xs text-slate-500 mb-1">Tên sản phẩm</label>
                          <input type="text" value={item.product_name} onChange={e => { const u = [...editItems]; u[idx].product_name = e.target.value; setEditItems(u); }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Số lượng</label>
                          <input type="number" min="0" step="0.1" value={item.quantity} onChange={e => { const u = [...editItems]; u[idx].quantity = parseFloat(e.target.value) || 0; setEditItems(u); }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Đơn giá (đ)</label>
                          <input type="number" min="0" step="1000" value={item.unit_price} onChange={e => { const u = [...editItems]; u[idx].unit_price = parseFloat(e.target.value) || 0; setEditItems(u); }}
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
              <button onClick={() => setEditModal(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Hủy</button>
              <button onClick={handleSaveEdit} disabled={saving}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold flex items-center gap-2">
                {saving ? <><Loader2 size={14} className="animate-spin" /> Đang lưu...</> : <><Save size={14} /> Lưu thay đổi</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page({ params }: { params: any }) {
  return <AuthGuard><QuotationDetailPage params={params} /></AuthGuard>;
}