'use client';

import React, { useState, useEffect, use as useReact } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Building2, Phone, Mail, ShoppingBag, Trash2,
  Clock, Plus, Loader2, Edit2, Check, X, RefreshCw, Save,
  FileText, MessageSquare, Calendar, History, CheckCircle2,
  Circle, CreditCard, AlertTriangle, TrendingUp, Shield, Star,
  Truck, Package, ChevronRight
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import AuthGuard from '@/components/AuthGuard';

interface Customer {
  id: number; name: string; company: string;
  phone: string; email: string; value: string;
  pipeline?: string;
  credit_limit?: number;
  tier?: string; tier_note?: string;
  completed_value?: string; paid_value?: string; remaining_value?: string;
  credit_warning?: boolean; credit_used_pct?: number;
  recommendation?: string; suggested_tier?: string | null;
  reasons?: string[]; days_since_last_contact?: number;
}
interface Interaction { id: number; content: string; noteType: string; createdAt: string; }
interface Task { id: number; title: string; dueDate: string; isCompleted: boolean; }
interface OrderItem { id?: number; product_name: string; quantity: number; unit_price: number; }
interface OrderLog { id: number; change_summary: string; updated_by: string; created_at: string; }
interface Quotation {
  id: number; quote_number: string; total_value: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  created_at: string; valid_days: number;
  sales_support?: string; delivery_person?: string; delivery_status?: string;
}
interface Debt {
  id: number; title: string; total_amount: number; paid_amount: number;
  remaining_amount: number; due_date: string;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue';
  quote_number?: string; accountant?: string; invoice_number?: string; invoice_date?: string;
}

const TIERS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  vip:      { label: 'VIP',           color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-300',   icon: '⭐' },
  priority: { label: 'ưu tiên',       color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-300',       icon: '🔵' },
  normal:   { label: 'Bình thường',   color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-300', icon: '🟢' },
  caution:  { label: 'Cần lưu ý',    color: 'text-orange-700', bg: 'bg-orange-50 border-orange-300',   icon: '🟡' },
  low:      { label: 'Không ưu tiên', color: 'text-slate-600',  bg: 'bg-slate-100 border-slate-300',    icon: '⚪' },
};

const PIPELINE_STEPS = [
  { key: 'approach',    label: 'Tiếp cận',       dept: 'Kinh doanh',  color: 'bg-slate-100 text-slate-600 border-slate-300',       dot: 'bg-slate-400',   short: 'Tiếp cận' },
  { key: 'survey',     label: 'Khảo sát',         dept: 'Kinh doanh',  color: 'bg-blue-50 text-blue-600 border-blue-200',            dot: 'bg-blue-400',    short: 'Khảo sát' },
  { key: 'quoted',     label: 'Gửi báo giá',   dept: 'Kinh doanh',  color: 'bg-purple-50 text-purple-600 border-purple-200',      dot: 'bg-purple-500',  short: 'Báo giá' },
  { key: 'negotiating',label: 'Đàm phán',       dept: 'Kinh doanh',  color: 'bg-amber-50 text-amber-700 border-amber-200',         dot: 'bg-amber-500',   short: 'Đàm phán' },
  { key: 'signed',     label: 'Lên đơn',            dept: 'Hỗ trợ KD', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500', short: 'Lên đơn' },
  { key: 'delivering', label: 'Giao hàng',             dept: 'Vận chuyển', color: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500', short: 'Giao hàng' },
  { key: 'collecting', label: 'Thu tiền',            dept: 'Kế toán', color: 'bg-rose-50 text-rose-700 border-rose-200',         dot: 'bg-rose-500',    short: 'Thu tiền' },
  { key: 'done',       label: 'Hoàn thành',         dept: 'Tất cả',  color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', short: 'Xong' },
];
const PIPELINE_MAP = Object.fromEntries(PIPELINE_STEPS.map(s => [s.key, s]));

const DELIVERY_STATUS: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Chờ giao',  color: 'bg-slate-100 text-slate-500' },
  in_progress: { label: 'Đang giao', color: 'bg-orange-50 text-orange-600' },
  delivered:   { label: 'Đã giao',color: 'bg-emerald-50 text-emerald-700' },
};

const DEBT_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  unpaid:  { label: 'Chưa trả',     color: 'bg-amber-50 text-amber-700 border-amber-200',      icon: React.createElement(Clock, {size:11}) },
  partial: { label: 'Trả một phần',color:'bg-blue-50 text-blue-600 border-blue-200',    icon: React.createElement(CreditCard, {size:11}) },
  paid:    { label: 'Đã thanh toán',color:'bg-emerald-50 text-emerald-700 border-emerald-200',icon: React.createElement(CheckCircle2,{size:11}) },
  overdue: { label: 'Quá hạn',        color: 'bg-red-50 text-red-600 border-red-200',            icon: React.createElement(AlertTriangle,{size:11}) },
};

type TabType = 'orders' | 'quotations' | 'debts' | 'notes' | 'tasks';

function CustomerDetailPage({ params }: { params: any }) {
  const resolvedParams = useReact(params) as { id: string };
  const idRaw = resolvedParams.id;
  const router = useRouter();
  const id = Number(idRaw);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('orders');
  const [updatingPipeline, setUpdatingPipeline] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderLogs, setOrderLogs] = useState<OrderLog[]>([]);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState('Gọi điện');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name:'', company:'', phone:'', email:'', value:'', credit_limit:'', tier:'normal', tier_note:'' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [payModal, setPayModal] = useState<Debt | null>(null);
  const [payForm, setPayForm] = useState({ amount:'', paid_at: new Date().toISOString().split('T')[0], note:'' });
  const [payHistory, setPayHistory] = useState<any[]>([]);
  const [payingSaving, setPayingSaving] = useState(false);
  const [editingDueDateId, setEditingDueDateId] = useState<number | null>(null);
  const [newDueDate, setNewDueDate] = useState('');
  const [savingDueDate, setSavingDueDate] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<number | null>(null);
  const [quoteEditForm, setQuoteEditForm] = useState({ sales_support:'', delivery_person:'', delivery_status:'pending' });
  const [savingQuote, setSavingQuote] = useState(false);
  const [editingDebtId, setEditingDebtId] = useState<number | null>(null);
  const [debtEditForm, setDebtEditForm] = useState({ accountant:'', invoice_number:'', invoice_date:'' });
  const [savingDebt, setSavingDebt] = useState(false);
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ from_debt_id: '', to_debt_id: '', amount: '', note: '' });
  const [savingAdjust, setSavingAdjust] = useState(false);

  const fetchAll = async () => {
    const [c, o, ol, i, t, q, d] = await Promise.all([
      fetchWithAuth(`/api/customers/${id}`),
      fetchWithAuth(`/api/customers/${id}/orders`),
      fetchWithAuth(`/api/customers/${id}/orders/logs`),
      fetchWithAuth(`/api/customers/${id}/interactions`),
      fetchWithAuth(`/api/customers/${id}/tasks`),
      fetchWithAuth(`/api/quotations?customerId=${id}`),
      fetchWithAuth(`/api/debts?customerId=${id}`),
    ]);
    if (c.ok) setCustomer(await c.json());
    if (o.ok) { const dd = await o.json(); setOrderItems(Array.isArray(dd) ? dd : []); }
    if (ol.ok) { const dd = await ol.json(); setOrderLogs(Array.isArray(dd) ? dd : []); }
    if (i.ok) setInteractions(await i.json());
    if (t.ok) setTasks(await t.json());
    if (q.ok) { const dd = await q.json(); setQuotations(Array.isArray(dd) ? dd : []); }
    if (d.ok) { const dd = await d.json(); setDebts(Array.isArray(dd) ? dd : []); }
  };

  useEffect(() => {
    if (!idRaw) return;
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [idRaw]);

  const api = (url: string, opts?: RequestInit) => fetchWithAuth(url, opts);

  const handlePipelineChange = async (v: string) => {
    setUpdatingPipeline(true);
    await api(`/api/customers/${id}`, { method:'PUT', body: JSON.stringify({ pipeline: v }) });
    if (customer) setCustomer({ ...customer, pipeline: v });
    setUpdatingPipeline(false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingEdit(true);
    const res = await api(`/api/customers/${id}`, { method:'PUT', body: JSON.stringify(editForm) });
    if (res.ok) { setCustomer(await res.json()); setEditModal(false); }
    setSavingEdit(false);
  };

  const handleApplySuggestedTier = async () => {
    if (!customer?.suggested_tier) return;
    await api(`/api/customers/${id}`, { method:'PUT', body: JSON.stringify({ tier: customer.suggested_tier }) });
    const res = await api(`/api/customers/${id}`);
    if (res.ok) setCustomer(await res.json());
  };

  const handleSaveOrder = async () => {
    setIsEditingOrder(false);
    const res = await api(`/api/customers/${id}/orders`, { method:'POST', body: JSON.stringify({ items: orderItems }) });
    const data = await res.json();
    if (!data.success) { alert('Lỗi: ' + data.error); setIsEditingOrder(true); }
    else {
      const [c, o, ol] = await Promise.all([api(`/api/customers/${id}`), api(`/api/customers/${id}/orders`), api(`/api/customers/${id}/orders/logs`)]);
      if (c.ok) setCustomer(await c.json());
      if (o.ok) { const d = await o.json(); setOrderItems(Array.isArray(d)?d:[]); }
      if (ol.ok) { const d = await ol.json(); setOrderLogs(Array.isArray(d)?d:[]); }
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault(); if (!noteContent.trim()) return;
    const res = await api(`/api/customers/${id}/interactions`, { method:'POST', body: JSON.stringify({ content: noteContent.trim(), noteType }) });
    if (res.ok) { setNoteContent(''); const r = await api(`/api/customers/${id}/interactions`); if (r.ok) setInteractions(await r.json()); }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault(); if (!taskTitle.trim() || !taskDueDate) return;
    const res = await api(`/api/customers/${id}/tasks`, { method:'POST', body: JSON.stringify({ title: taskTitle.trim(), dueDate: taskDueDate }) });
    if (res.ok) { setTaskTitle(''); setTaskDueDate(''); const r = await api(`/api/customers/${id}/tasks`); if (r.ok) setTasks(await r.json()); }
  };

  const handleToggleTask = async (taskId: number, current: boolean) => {
    await api(`/api/customers/${id}/tasks`, { method:'PUT', body: JSON.stringify({ taskId: String(taskId), isCompleted: !current }) });
    const r = await api(`/api/customers/${id}/tasks`); if (r.ok) setTasks(await r.json());
  };

  const handleSaveEditTask = async (taskId: number) => {
    await api(`/api/customers/${id}/tasks`, { method:'PUT', body: JSON.stringify({ taskId: String(taskId), title: editTitle, dueDate: editDueDate }) });
    setEditingTaskId(null); const r = await api(`/api/customers/${id}/tasks`); if (r.ok) setTasks(await r.json());
  };

  const openPayModal = async (debt: Debt) => {
    setPayModal(debt); setPayForm({ amount:'', paid_at: new Date().toISOString().split('T')[0], note:'' });
    const res = await api(`/api/debts/${debt.id}`);
    if (res.ok) { const d = await res.json(); setPayHistory(d.payments || []); }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault(); if (!payModal) return; setPayingSaving(true);
    const res = await api(`/api/debts/${payModal.id}`, { method:'POST', body: JSON.stringify(payForm) });
    const data = await res.json();
    if (data.success) {
      setPayModal(null);
      const [d, c] = await Promise.all([api(`/api/debts?customerId=${id}`), api(`/api/customers/${id}`)]);
      if (d.ok) { const dd = await d.json(); setDebts(Array.isArray(dd)?dd:[]); }
      if (c.ok) setCustomer(await c.json());
    } else alert('Lỗi: ' + data.error);
    setPayingSaving(false);
  };

  const handleSaveDueDate = async (debtId: number) => {
    if (!newDueDate) return; setSavingDueDate(true);
    const res = await api(`/api/debts/${debtId}`, { method:'PUT', body: JSON.stringify({ due_date: newDueDate }) });
    if ((await res.json()).success) {
      setEditingDueDateId(null);
      const r = await api(`/api/debts?customerId=${id}`); if (r.ok) { const d = await r.json(); setDebts(Array.isArray(d)?d:[]); }
    }
    setSavingDueDate(false);
  };

  const handleSaveQuoteExtra = async (quoteId: number) => {
    setSavingQuote(true);
    await api(`/api/quotations/${quoteId}/edit`, { method:'PUT', body: JSON.stringify(quoteEditForm) });
    setEditingQuoteId(null);
    const r = await api(`/api/quotations?customerId=${id}`); if (r.ok) { const d = await r.json(); setQuotations(Array.isArray(d)?d:[]); }
    setSavingQuote(false);
  };

  const handleSaveDebtExtra = async (debtId: number) => {
    setSavingDebt(true);
    await api(`/api/debts/${debtId}`, { method:'PUT', body: JSON.stringify(debtEditForm) });
    setEditingDebtId(null);
    const r = await api(`/api/debts?customerId=${id}`); if (r.ok) { const d = await r.json(); setDebts(Array.isArray(d)?d:[]); }
    setSavingDebt(false);
  };

  const handleAdjust = async () => {
    if (!adjustForm.from_debt_id || !adjustForm.to_debt_id || !adjustForm.amount) {
      alert('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    setSavingAdjust(true);
    const res = await api('/api/debts/adjust', {
      method: 'POST',
      body: JSON.stringify({
        from_debt_id: parseInt(adjustForm.from_debt_id),
        to_debt_id: parseInt(adjustForm.to_debt_id),
        amount: parseFloat(adjustForm.amount),
        note: adjustForm.note
      })
    });
    if (res.ok) {
      setAdjustModal(false);
      setAdjustForm({ from_debt_id: '', to_debt_id: '', amount: '', note: '' });
      const r = await api(`/api/debts?customerId=${id}`);
      if (r.ok) { const d = await r.json(); setDebts(Array.isArray(d)?d:[]); }
      const c = await api(`/api/customers/${id}`);
      if (c.ok) { const d = await c.json(); setCustomer(d); }
    } else {
      const err = await res.json();
      alert('Lỗi: ' + err.error);
    }
    setSavingAdjust(false);
  };

  const fmt = (v: number | string) => {
    const n = parseInt(String(v).replace(/[^0-9]/g,''), 10);
    if (isNaN(n) || n === 0) return '0 đ';
    if (n >= 1_000_000_000) return `${(n/1_000_000_000).toFixed(1)} tỷ đ`;
    if (n >= 1_000_000) return `${(n/1_000_000).toFixed(0)} tr đ`;
    return new Intl.NumberFormat('vi-VN').format(n) + ' đ';
  };

  const acceptedQuotes = quotations.filter(q => q.status === 'accepted');
  const activeQuotes   = quotations.filter(q => q.status === 'draft' || q.status === 'sent');
  const rejectedQuotes = quotations.filter(q => q.status === 'rejected');

  const TABS = [
    { key: 'orders' as TabType,     label: 'Đơn hàng',   icon: 'ShoppingBag', count: acceptedQuotes.length,                       bc: 'bg-emerald-100 text-emerald-700' },
    { key: 'quotations' as TabType, label: 'Báo giá',    icon: 'FileText',    count: activeQuotes.length,                         bc: 'bg-amber-100 text-amber-700' },
    { key: 'debts' as TabType,      label: 'Công nợ',    icon: 'CreditCard',  count: debts.filter(d=>d.status!=='paid').length,   bc: debts.some(d=>d.status==='overdue')?'bg-red-100 text-red-700':'bg-slate-100 text-slate-500' },
    { key: 'notes' as TabType,      label: 'Nhật ký',    icon: 'MessageSquare',count: interactions.length,                        bc: 'bg-slate-100 text-slate-500' },
    { key: 'tasks' as TabType,      label: 'Việc cần làm',icon:'Calendar', count: tasks.filter(t=>!t.isCompleted).length,      bc: 'bg-slate-100 text-slate-500' },
  ];

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;
  if (!customer) return <div className="p-8 text-center text-red-500 font-bold">Khách hàng không tồn tại.</div>;

  const tier = TIERS[customer.tier || 'normal'] || TIERS.normal;
  const pipeline = PIPELINE_MAP[customer.pipeline || 'approach'] || PIPELINE_MAP.approach;
  const pipelineIdx = PIPELINE_STEPS.findIndex(s => s.key === (customer.pipeline || 'approach'));
  const creditLimit = parseFloat(String(customer.credit_limit || 0));
  const remainingValue = parseFloat(customer.remaining_value || '0');
  const suggestedTierInfo = customer.suggested_tier ? TIERS[customer.suggested_tier] : null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-5">

        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => router.push('/customers')} className="flex items-center gap-2 text-sm font-bold text-slate-600 border border-slate-200 bg-white px-4 py-2 rounded-xl hover:bg-slate-50"><ArrowLeft size={16} /> Quay lại</button>
          <button onClick={() => router.push(`/quotations/new?customerId=${id}`)} className="flex items-center gap-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl shadow-lg shadow-indigo-100"><FileText size={15} /> Tạo báo giá</button>
        </div>

        {customer.credit_warning && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-center gap-3">
            <AlertTriangle size={20} className="text-red-500 shrink-0" />
            <div>
              <p className="font-bold text-red-700 text-sm">⚠️ Vượt giới hạn công nợ!</p>
              <p className="text-xs text-red-600 mt-0.5">Còn nợ <span className="font-bold">{fmt(remainingValue)}</span> — vượt {fmt(remainingValue - creditLimit)} so với giới hạn {fmt(creditLimit)}.</p>
            </div>
          </div>
        )}

        {customer.recommendation && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Star size={12} className="text-amber-500" /> Khuyến nghị cho nhân viên</p>
                <div className="space-y-1">{(customer.reasons||[]).map((r,i)=><p key={i} className="text-sm text-slate-700">{r}</p>)}</div>
                {(!customer.reasons||customer.reasons.length===0) && <p className="text-sm text-slate-600">{customer.recommendation}</p>}
                {customer.days_since_last_contact !== undefined && customer.days_since_last_contact < 999 && (
                  <p className="text-xs text-slate-400 mt-2">Liên hệ gần nhất: <span className={`font-bold ${customer.days_since_last_contact>30?'text-red-500':customer.days_since_last_contact>14?'text-amber-500':'text-emerald-500'}`}>{customer.days_since_last_contact} ngày trước</span></p>
                )}
              </div>
              {suggestedTierInfo && customer.suggested_tier !== customer.tier && (
                <div className="shrink-0 text-center">
                  <p className="text-xs text-slate-400 mb-1.5">Gợi ý hạng KH</p>
                  <div className={`text-xs font-bold px-3 py-1.5 rounded-full border ${suggestedTierInfo.bg} ${suggestedTierInfo.color} mb-2`}>{suggestedTierInfo.icon} {suggestedTierInfo.label}</div>
                  <button onClick={handleApplySuggestedTier} className="text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-xl hover:bg-indigo-700">Áp dụng</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Card KH */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          {/* Pipeline */}
          <div className="space-y-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Hạng:</span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${tier.bg} ${tier.color}`}>{tier.icon} {tier.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Pipeline:</span>
                <div className="relative inline-flex items-center">
                  <span className={`absolute left-3 w-2 h-2 rounded-full ${pipeline.dot}`} />
                  <select value={customer.pipeline||'approach'} onChange={e=>handlePipelineChange(e.target.value)} disabled={updatingPipeline}
                    className={`appearance-none font-bold text-xs pl-7 pr-8 py-1.5 rounded-full border cursor-pointer outline-none disabled:opacity-60 ${pipeline.color}`}>
                    {PIPELINE_STEPS.map(s=><option key={s.key} value={s.key}>{s.label} ({s.dept})</option>)}
                  </select>
                  {updatingPipeline ? <RefreshCw size={12} className="animate-spin absolute right-2.5 pointer-events-none text-slate-400" /> : <svg className="absolute right-2.5 w-3 h-3 opacity-60 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>}
                </div>
              </div>
            </div>
            {/* Thanh tiến trình */}
            <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
              {PIPELINE_STEPS.map((step, idx) => {
                const isDone = idx <= pipelineIdx;
                const isCurrent = idx === pipelineIdx;
                return (
                  <React.Fragment key={step.key}>
                    <button onClick={() => handlePipelineChange(step.key)}
                      className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${isCurrent ? `${step.color} ring-2 ring-offset-1 ring-current` : isDone ? `${step.color} opacity-75` : 'bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100'}`}>
                      {isDone && !isCurrent ? '✓ ' : ''}{step.short}
                    </button>
                    {idx < PIPELINE_STEPS.length-1 && <ChevronRight size={12} className={`shrink-0 ${idx < pipelineIdx ? 'text-slate-400' : 'text-slate-200'}`} />}
                  </React.Fragment>
                );
              })}
            </div>
            <p className="text-xs text-slate-400">Bộ phận phụ trách: <span className="font-bold text-slate-600">{pipeline.dept}</span></p>
          </div>

          {/* Thông tin + liên hệ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 border-t border-slate-100">
            <div className="md:col-span-2 space-y-2">
              <h2 className="text-2xl font-black text-slate-900">{customer.name}</h2>
              <div className="text-sm text-slate-500 flex items-center gap-2"><Building2 size={14} /> {customer.company}</div>
              {customer.tier_note && <div className="text-xs text-slate-500 italic bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">📝 {customer.tier_note}</div>}
              <div className="flex gap-4 flex-wrap text-xs text-slate-500 pt-1">
                <span><span className="font-bold text-emerald-600">{acceptedQuotes.length}</span> đơn hàng đã chốt</span>
                <span><span className="font-bold text-amber-600">{activeQuotes.length}</span> báo giá đang TT</span>
                <span><span className={`font-bold ${debts.filter(d=>d.status!=='paid').length>0?'text-red-600':'text-slate-600'}`}>{debts.filter(d=>d.status!=='paid').length}</span> khoản nợ chưa trả</span>
              </div>
            </div>
            <div className={`p-4 rounded-xl space-y-2 text-xs border ${customer.credit_warning?'bg-red-50 border-red-200':'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-black text-slate-400 uppercase tracking-wider">Liên hệ</span>
                <button onClick={() => { setEditForm({name:customer.name,company:customer.company,phone:customer.phone,email:customer.email,value:customer.value,credit_limit:String(customer.credit_limit||''),tier:customer.tier||'normal',tier_note:customer.tier_note||''}); setEditModal(true); }} className="flex items-center gap-1 text-xs font-bold text-indigo-600 border border-indigo-200 bg-white px-2.5 py-1 rounded-lg hover:bg-indigo-50"><Edit2 size={11} /> Sửa</button>
              </div>
              <div className="flex items-center gap-2 text-slate-700"><Phone size={13} className="text-slate-400" /> {customer.phone||'—'}</div>
              <div className="flex items-center gap-2 text-slate-700"><Mail size={13} className="text-slate-400" /> {customer.email||'—'}</div>
              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                <div className="flex justify-between"><span className="text-slate-500">🎯 Ước tính</span><span className="font-bold text-indigo-600">{fmt(customer.value)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 flex items-center gap-1"><TrendingUp size={11} className="text-emerald-500" /> Đã chốt HĐ</span><span className="font-bold text-emerald-600">{fmt(customer.completed_value||'0')}</span></div>
                <div className="border-t border-slate-100 pt-1.5 space-y-1.5">
                  <div className="flex justify-between"><span className="text-slate-500 flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-500" /> Đã thanh toán</span><span className="font-bold text-emerald-600">{fmt(customer.paid_value||'0')}</span></div>
                  {remainingValue > 0 ? (
                    <div className="flex justify-between"><span className="text-slate-500 flex items-center gap-1"><AlertTriangle size={11} className="text-red-500" /> Còn nợ</span><span className="font-bold text-red-600">{fmt(remainingValue)}</span></div>
                  ) : remainingValue < 0 ? (
                    <div className="flex justify-between"><span className="text-slate-500 flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-500" /> Trả thừa</span><span className="font-bold text-emerald-600">{fmt(Math.abs(remainingValue))}</span></div>
                  ) : (
                    <div className="flex justify-between"><span className="text-slate-500">✅ Đã thanh toán đủ</span><span className="font-bold text-emerald-600">0 đ</span></div>
                  )}
                </div>
                {creditLimit > 0 && (
                  <div className="border-t border-slate-100 pt-1.5">
                    <div className="flex justify-between mb-1"><span className="text-slate-500 flex items-center gap-1"><Shield size={11} className={customer.credit_warning?'text-red-500':'text-slate-400'} /> Giới hạn nợ</span><span className={`font-bold ${customer.credit_warning?'text-red-600':'text-slate-600'}`}>{fmt(creditLimit)}</span></div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5"><div className={`h-1.5 rounded-full ${(customer.credit_used_pct||0)>=100?'bg-red-500':(customer.credit_used_pct||0)>=80?'bg-amber-400':'bg-emerald-400'}`} style={{width:`${Math.min(customer.credit_used_pct||0,100)}%`}} /></div>
                    <div className={`text-[10px] mt-0.5 text-right ${customer.credit_warning?'text-red-600 font-bold':'text-slate-400'}`}>{customer.credit_used_pct||0}%</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-100 overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold whitespace-nowrap transition-all border-b-2 ${activeTab===tab.key?'border-indigo-600 text-indigo-600 bg-indigo-50/50':'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                {tab.label}
                {tab.count > 0 && <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${activeTab===tab.key?'bg-indigo-100 text-indigo-700':tab.bc}`}>{tab.count}</span>}
              </button>
            ))}
          </div>
          <div className="p-6">

            {/* ── ĐƠN HÀNG ── */}
            {activeTab === 'orders' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div><h3 className="font-bold text-slate-800 text-sm">Đơn hàng đã lên đơn</h3><p className="text-xs text-slate-400 mt-0.5">Báo giá được chấp nhận · Hỗ trợ KD lên đơn · Vận chuyển giao hàng</p></div>
                  <button onClick={() => router.push(`/quotations/new?customerId=${id}`)} className="text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-xl flex items-center gap-1 hover:bg-indigo-700"><Plus size={12} /> Tạo báo giá</button>
                </div>
                {acceptedQuotes.length === 0 ? (
                  <div className="text-center py-12 text-slate-400"><ShoppingBag size={32} className="mx-auto mb-3 opacity-30" /><p className="italic text-sm">Chưa có đơn hàng nào được chốt.</p></div>
                ) : (
                  <div className="space-y-3">
                    {acceptedQuotes.map(q => {
                      const isEditing = editingQuoteId === q.id;
                      const ds = DELIVERY_STATUS[q.delivery_status||'pending'];
                      return (
                        <div key={q.id} className="border border-emerald-200 rounded-2xl overflow-hidden">
                          <div className="bg-emerald-50/40 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <button onClick={() => router.push(`/quotations/${q.id}`)} className="font-bold text-emerald-700 hover:underline text-sm">{q.quote_number}</button>
                              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">✅ Đã lên đơn</span>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ds.color}`}>{ds.label}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-black text-slate-900">{fmt(Number(q.total_value))}</span>
                              <button onClick={() => { setEditingQuoteId(isEditing?null:q.id); setQuoteEditForm({sales_support:q.sales_support||'',delivery_person:q.delivery_person||'',delivery_status:q.delivery_status||'pending'}); }} className="text-slate-400 hover:text-indigo-600"><Edit2 size={14} /></button>
                            </div>
                          </div>
                          <div className="px-4 py-3">
                            {!isEditing ? (
                              <div className="flex flex-wrap gap-6 text-xs text-slate-600">
                                <div><span className="text-slate-400">Hỗ trợ KD:</span> <span className={q.sales_support?'font-bold':'italic text-slate-400'}>{q.sales_support||'Chưa gán'}</span></div>
                                <div className="flex items-center gap-1"><Truck size={12} className="text-orange-400" /><span className="text-slate-400">Vận chuyển:</span> <span className={q.delivery_person?'font-bold':'italic text-slate-400'}>{q.delivery_person||'Chưa gán'}</span></div>
                                <div className="text-slate-400">{new Date(q.created_at).toLocaleDateString('vi-VN')}</div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="grid grid-cols-3 gap-3">
                                  <div><label className="block text-xs font-bold text-slate-500 mb-1">Hỗ trợ KD</label><input type="text" value={quoteEditForm.sales_support} onChange={e=>setQuoteEditForm({...quoteEditForm,sales_support:e.target.value})} placeholder="Tên nhân viên..." className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-400" /></div>
                                  <div><label className="block text-xs font-bold text-slate-500 mb-1">Vận chuyển</label><input type="text" value={quoteEditForm.delivery_person} onChange={e=>setQuoteEditForm({...quoteEditForm,delivery_person:e.target.value})} placeholder="Tên tài xế..." className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-400" /></div>
                                  <div><label className="block text-xs font-bold text-slate-500 mb-1">Trạng thái giao</label><select value={quoteEditForm.delivery_status} onChange={e=>setQuoteEditForm({...quoteEditForm,delivery_status:e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-400"><option value="pending">Chờ giao</option><option value="in_progress">Đang giao</option><option value="delivered">Đã giao</option></select></div>
                                </div>
                                <div className="flex justify-end gap-2">
                                  <button onClick={()=>setEditingQuoteId(null)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs hover:bg-slate-50">Hủy</button>
                                  <button onClick={()=>handleSaveQuoteExtra(q.id)} disabled={savingQuote} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-indigo-700 disabled:opacity-60">{savingQuote?<Loader2 size={12} className="animate-spin"/>:<Save size={12}/>} Lưu</button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {orderItems.length > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Package size={12} /> Cấu phần sản phẩm</p>
                          {!isEditingOrder ? <button onClick={()=>setIsEditingOrder(true)} className="text-xs font-bold border border-slate-200 bg-white text-slate-600 px-3 py-1.5 rounded-xl flex items-center gap-1 hover:bg-slate-50"><Edit2 size={12}/> Điều chỉnh</button> : <div className="flex gap-2"><button onClick={()=>setOrderItems([...orderItems,{product_name:'',quantity:1,unit_price:0}])} className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl flex items-center gap-1"><Plus size={12}/> Thêm</button><button onClick={handleSaveOrder} className="text-xs font-bold bg-emerald-600 text-white px-3 py-1.5 rounded-xl flex items-center gap-1"><Save size={12}/> Lưu</button><button onClick={()=>{setIsEditingOrder(false);}} className="text-xs font-bold bg-slate-400 text-white px-3 py-1.5 rounded-xl">Hủy</button></div>}
                        </div>
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                          <table className="w-full text-xs border-collapse">
                            <thead><tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-400 uppercase tracking-wider"><th className="px-4 py-3 text-left">Sản phẩm</th><th className="px-4 py-3 text-right">SL</th><th className="px-4 py-3 text-right">Đơn giá</th><th className="px-4 py-3 text-right">Thành tiền</th>{isEditingOrder&&<th className="px-4 py-3"/>}</tr></thead>
                            <tbody className="divide-y divide-slate-100">
                              {orderItems.map((item,idx)=>(
                                <tr key={idx} className="hover:bg-slate-50/40">
                                  <td className="px-4 py-2.5">{isEditingOrder?<input value={item.product_name} onChange={e=>{const u=[...orderItems];u[idx].product_name=e.target.value;setOrderItems(u);}} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none"/>:<span className="font-semibold">{item.product_name}</span>}</td>
                                  <td className="px-4 py-2.5 text-right">{isEditingOrder?<input type="number" value={item.quantity} onChange={e=>{const u=[...orderItems];u[idx].quantity=Number(e.target.value);setOrderItems(u);}} className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none text-right"/>:item.quantity}</td>
                                  <td className="px-4 py-2.5 text-right">{isEditingOrder?<input type="number" value={item.unit_price} onChange={e=>{const u=[...orderItems];u[idx].unit_price=Number(e.target.value);setOrderItems(u);}} className="w-32 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none text-right"/>:new Intl.NumberFormat('vi-VN').format(item.unit_price)+' đ'}</td>
                                  <td className="px-4 py-2.5 text-right font-black text-slate-900">{fmt(item.quantity*item.unit_price)}</td>
                                  {isEditingOrder&&<td className="px-4 py-2.5 text-center"><button onClick={()=>setOrderItems(orderItems.filter((_,i)=>i!==idx))} className="text-rose-400 hover:text-rose-600"><Trash2 size={14}/></button></td>}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {orderLogs.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><History size={13}/> Lịch sử biến động</p>
                        <div className="space-y-2 max-h-48 overflow-y-auto">{orderLogs.map(log=>(
                          <div key={log.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs">
                            <div className="flex justify-between mb-1"><span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">📝 {log.updated_by}</span><span className="text-slate-400">{new Date(log.created_at).toLocaleString('vi-VN')}</span></div>
                            <p className="text-slate-600 whitespace-pre-wrap">{log.change_summary.split(' | ').join('\n')}</p>
                          </div>
                        ))}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── BÁO GIÁ ── */}
            {activeTab === 'quotations' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div><h3 className="font-bold text-slate-800 text-sm">Báo giá đang thương thảo</h3><p className="text-xs text-slate-400 mt-0.5">Nháp và đã gửi — chờ phản hồi từ khách hàng</p></div>
                  <button onClick={() => router.push(`/quotations/new?customerId=${id}`)} className="text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-xl flex items-center gap-1 hover:bg-indigo-700"><Plus size={12}/> Tạo báo giá</button>
                </div>
                {activeQuotes.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl"><FileText size={28} className="mx-auto mb-2 opacity-30"/><p className="italic text-sm">Không có báo giá đang thương thảo.</p></div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {activeQuotes.map(q=>{
                      const qs = q.status==='sent'?{label:'Đã gửi',color:'bg-blue-50 text-blue-600'}:{label:'Nháp',color:'bg-slate-100 text-slate-600'};
                      return (
                        <div key={q.id} onClick={()=>router.push(`/quotations/${q.id}`)} className="flex items-center justify-between p-4 hover:bg-amber-50 cursor-pointer group">
                          <div><span className="font-bold text-indigo-600 text-sm group-hover:underline">{q.quote_number}</span><div className="text-xs text-slate-400 mt-0.5">HV: {q.valid_days} ngày · {new Date(q.created_at).toLocaleDateString('vi-VN')}</div></div>
                          <div className="flex items-center gap-3"><span className="font-black text-slate-900 text-sm">{fmt(Number(q.total_value))}</span><span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${qs.color}`}>{qs.label}</span></div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {rejectedQuotes.length > 0 && (
                  <div className="mt-2"><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Đã từ chối ({rejectedQuotes.length})</p>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden opacity-50">
                      {rejectedQuotes.map(q=>(
                        <div key={q.id} onClick={()=>router.push(`/quotations/${q.id}`)} className="flex items-center justify-between p-3 hover:bg-slate-50 cursor-pointer">
                          <span className="font-semibold text-slate-500 text-sm line-through">{q.quote_number}</span>
                          <div className="flex items-center gap-3"><span className="text-slate-500 text-sm">{fmt(Number(q.total_value))}</span><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-500">Từ chối</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── CÔNG NỢ ── */}
            {activeTab === 'debts' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between"><div><h3 className="font-bold text-slate-800 text-sm">Quản lý công nợ</h3><p className="text-xs text-slate-400 mt-0.5">Kế toán xuất hóa đơn · Theo dõi thu tiền</p></div>{debts.length > 1 && <button onClick={() => setAdjustModal(true)} className="text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-xl flex items-center gap-1 hover:bg-indigo-700"><Save size={12}/> Điều chỉnh</button>}</div>
                {debts.length === 0 ? <div className="text-center py-10 text-slate-400 italic text-sm">Chưa có công nợ nào.</div> : (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      {(() => {
                        const totalDebt = debts.reduce((s,d)=>s+Number(d.total_amount),0);
                        const paidAmount = debts.reduce((s,d)=>s+Number(d.paid_amount),0);
                        const remaining = totalDebt - paidAmount;
                        const label = remaining > 0 ? 'Còn lại' : remaining < 0 ? 'Trả thừa' : 'Đã trả hết';
                        const color = remaining > 0 ? 'text-red-600' : 'text-emerald-600';
                        return [
                          {label:'Tổng nợ',value:fmt(totalDebt),color:'text-slate-900'},
                          {label:'Đã trả',value:fmt(paidAmount),color:'text-emerald-600'},
                          {label,value:fmt(Math.abs(remaining)),color}
                        ];
                      })().map(s=>(
                        <div key={s.label} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center"><p className="text-xs text-slate-400 font-bold">{s.label}</p><p className={`text-base font-black mt-0.5 ${s.color}`}>{s.value}</p></div>
                      ))}
                    </div>
                    <div className="space-y-3">
                      {debts.map(d=>{
                        const ds = DEBT_STATUS[d.status];
                        const pct = d.total_amount>0?Math.round((Number(d.paid_amount)/Number(d.total_amount))*100):0;
                        const isEditingThis = editingDueDateId===d.id;
                        const isEditingDebt = editingDebtId===d.id;
                        return (
                          <div key={d.id} className={`border rounded-2xl overflow-hidden ${d.status==='overdue'?'border-red-200':'border-slate-200'}`}>
                            <div className={`px-4 py-3 flex items-center justify-between flex-wrap gap-2 ${d.status==='overdue'?'bg-red-50/50':'bg-slate-50/50'}`}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-slate-900">{d.title}</span>
                                {d.quote_number&&<span className="text-xs text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full">BG: {d.quote_number}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${ds.color}`}>{ds.icon} {ds.label}</span>
                                <button onClick={()=>{setEditingDebtId(isEditingDebt?null:d.id);setDebtEditForm({accountant:d.accountant||'',invoice_number:d.invoice_number||'',invoice_date:d.invoice_date||''});}} className="text-slate-400 hover:text-indigo-600"><Edit2 size={13}/></button>
                              </div>
                            </div>
                            <div className="px-4 py-3 space-y-3">
                              <div className="space-y-1"><div className="flex justify-between text-xs text-slate-500"><span>Tiến độ thanh toán</span><span className="font-bold">{pct}%</span></div><div className="w-full bg-slate-100 rounded-full h-2"><div className={`h-2 rounded-full ${d.status==='paid'?'bg-emerald-500':d.status==='overdue'?'bg-red-500':'bg-amber-400'}`} style={{width:`${pct}%`}}/></div></div>
                              <div className="grid grid-cols-3 gap-3 text-xs">
                                <div><span className="text-slate-400">Tổng nợ</span><div className="font-black text-slate-900 mt-0.5">{fmt(Number(d.total_amount))}</div></div>
                                <div><span className="text-slate-400">Đã thanh toán</span><div className="font-black text-emerald-600 mt-0.5">{fmt(Number(d.paid_amount))}</div></div>
                                <div><span className="text-slate-400">Còn lại</span><div className={`font-black mt-0.5 ${d.status==='paid'?'text-emerald-600':'text-red-600'}`}>{fmt(Number(d.remaining_amount))}</div></div>
                              </div>
                              {!isEditingDebt ? (
                                <div className="flex flex-wrap gap-4 text-xs bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                                  <div><span className="text-slate-400">Kế toán:</span> <span className={d.accountant?'font-bold':'italic text-slate-400'}>{d.accountant||'Chưa gán'}</span></div>
                                  <div><span className="text-slate-400">Số HĐ:</span> <span className={d.invoice_number?'font-bold':'italic text-slate-400'}>{d.invoice_number||'Chưa xuất'}</span></div>
                                  {d.invoice_date&&<div><span className="text-slate-400">Ngày HĐ:</span> <span className="font-bold">{new Date(d.invoice_date).toLocaleDateString('vi-VN')}</span></div>}
                                </div>
                              ) : (
                                <div className="space-y-3 bg-slate-50 rounded-xl p-3 border border-slate-200">
                                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Thông tin kế toán</p>
                                  <div className="grid grid-cols-3 gap-3">
                                    <div><label className="block text-xs font-bold text-slate-500 mb-1">Kế toán phụ trách</label><input value={debtEditForm.accountant} onChange={e=>setDebtEditForm({...debtEditForm,accountant:e.target.value})} placeholder="Tên kế toán..." className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-400"/></div>
                                    <div><label className="block text-xs font-bold text-slate-500 mb-1">Số hóa đơn</label><input value={debtEditForm.invoice_number} onChange={e=>setDebtEditForm({...debtEditForm,invoice_number:e.target.value})} placeholder="VD: HD-2026-001" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-400"/></div>
                                    <div><label className="block text-xs font-bold text-slate-500 mb-1">Ngày xuất HĐ</label><input type="date" value={debtEditForm.invoice_date} onChange={e=>setDebtEditForm({...debtEditForm,invoice_date:e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-400"/></div>
                                  </div>
                                  <div className="flex justify-end gap-2"><button onClick={()=>setEditingDebtId(null)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs hover:bg-slate-100">Hủy</button><button onClick={()=>handleSaveDebtExtra(d.id)} disabled={savingDebt} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-indigo-700 disabled:opacity-60">{savingDebt?<Loader2 size={12} className="animate-spin"/>:<Save size={12}/>} Lưu</button></div>
                                </div>
                              )}
                              <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-slate-400">Hạn:</span>
                                  {isEditingThis ? (
                                    <div className="flex items-center gap-1.5"><input type="date" value={newDueDate} onChange={e=>setNewDueDate(e.target.value)} className="bg-white border border-indigo-300 rounded-lg px-2 py-1 text-xs outline-none"/><button onClick={()=>handleSaveDueDate(d.id)} disabled={savingDueDate} className="bg-indigo-600 text-white p-1 rounded-lg">{savingDueDate?<Loader2 size={12} className="animate-spin"/>:<Check size={12}/>}</button><button onClick={()=>setEditingDueDateId(null)} className="bg-slate-200 text-slate-600 p-1 rounded-lg"><X size={12}/></button></div>
                                  ) : (
                                    <div className="flex items-center gap-1.5"><span className={`font-bold ${d.status==='overdue'?'text-red-600':'text-slate-700'}`}>{new Date(d.due_date).toLocaleDateString('vi-VN')}{d.status==='overdue'&&` (Quá ${Math.floor((Date.now()-new Date(d.due_date).getTime())/86400000)} ngày)`}</span>{d.status!=='paid'&&<button onClick={()=>{setEditingDueDateId(d.id);setNewDueDate(d.due_date);}} className="text-slate-400 hover:text-indigo-600"><Edit2 size={11}/></button>}</div>
                                  )}
                                </div>
                                {d.status!=='paid' ? (
                                  <button onClick={()=>openPayModal(d)} className="flex items-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl"><CreditCard size={12}/> Ghi nhận thanh toán</button>
                                ) : <span className="flex items-center gap-1 text-xs font-bold text-emerald-600"><CheckCircle2 size={14}/> Đã thanh toán đầy đủ</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── NHẬT KÝ ── */}
            {activeTab === 'notes' && (
              <div className="space-y-4">
                <form onSubmit={handleAddNote} className="flex gap-2">
                  <select value={noteType} onChange={e=>setNoteType(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-600 outline-none">
                    <option value="Gọi điện">📞 Gọi điện</option><option value="Gặp mặt">🤝 Gặp mặt</option><option value="Email">✉️ Email</option><option value="Zalo">💬 Zalo</option>
                  </select>
                  <input value={noteContent} onChange={e=>setNoteContent(e.target.value)} placeholder="Nhập nội dung trao đổi..." className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:bg-white focus:border-indigo-500"/>
                  <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl">Lưu</button>
                </form>
                <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                  {interactions.length===0 ? <div className="text-center py-10 text-slate-400 italic text-sm">Chưa có nhật ký.</div> : interactions.map(log=>(
                    <div key={log.id} className="flex gap-3 items-start border-l-2 border-indigo-100 pl-4 relative ml-2">
                      <div className="absolute w-2 h-2 rounded-full bg-indigo-500 -left-[5px] top-1.5"/>
                      <div className="flex-1 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between text-xs mb-1"><span className="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{log.noteType}</span><span className="text-slate-400 flex items-center gap-1"><Clock size={11}/> {new Date(log.createdAt).toLocaleString('vi-VN')}</span></div>
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{log.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── VIỆC CẦN LÀM ── */}
            {activeTab === 'tasks' && (
              <div className="space-y-4">
                <form onSubmit={handleAddTask} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <input required value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder="Nội dung công việc..." className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400"/>
                  <div className="flex gap-2 items-end"><input type="date" required value={taskDueDate} onChange={e=>setTaskDueDate(e.target.value)} className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-indigo-400"/><button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1"><Plus size={14}/> Thêm việc</button></div>
                </form>
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {tasks.length===0 ? <div className="text-center py-10 text-slate-400 italic text-sm">Không có nhiệm vụ nào.</div> : tasks.map(task=>(
                    <div key={task.id} className={`flex items-center justify-between p-3 rounded-xl border ${task.isCompleted?'bg-slate-50/60 border-slate-100':'bg-white border-slate-200 shadow-sm'}`}>
                      {editingTaskId===task.id ? (
                        <div className="w-full space-y-2">
                          <input value={editTitle} onChange={e=>setEditTitle(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs outline-none"/>
                          <div className="flex gap-2 items-center justify-between"><input type="date" value={editDueDate} onChange={e=>setEditDueDate(e.target.value)} className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs outline-none"/><div className="flex gap-1"><button onClick={()=>handleSaveEditTask(task.id)} className="bg-emerald-600 text-white p-1 rounded"><Check size={14}/></button><button onClick={()=>setEditingTaskId(null)} className="bg-slate-400 text-white p-1 rounded"><X size={14}/></button></div></div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <button onClick={()=>handleToggleTask(task.id,task.isCompleted)} className="text-slate-400 hover:text-emerald-600 shrink-0">{task.isCompleted?<CheckCircle2 size={18} className="text-emerald-500"/>:<Circle size={18}/>}</button>
                            <div className="min-w-0"><p className={`text-sm font-semibold truncate ${task.isCompleted?'text-slate-400 line-through':'text-slate-800'}`}>{task.title}</p><p className="text-xs text-slate-400 flex items-center gap-1"><Clock size={11}/> Hạn: {task.dueDate}</p></div>
                          </div>
                          {!task.isCompleted&&<button onClick={()=>{setEditingTaskId(task.id);setEditTitle(task.title);setEditDueDate(task.dueDate);}} className="text-slate-400 hover:text-indigo-600 p-1 shrink-0"><Edit2 size={13}/></button>}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL SỬA */}
      {editModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 sticky top-0"><h3 className="font-bold text-slate-900">Chỉnh sửa thông tin</h3><button onClick={()=>setEditModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button></div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {[{label:'Tên khách hàng *',key:'name',required:true},{label:'Công ty',key:'company',required:false}].map(f=>(
                <div key={f.key}><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{f.label}</label><input type="text" required={f.required} value={(editForm as any)[f.key]} onChange={e=>setEditForm({...editForm,[f.key]:e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500"/></div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Điện thoại</label><input value={editForm.phone} onChange={e=>setEditForm({...editForm,phone:e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500"/></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email</label><input type="email" value={editForm.email} onChange={e=>setEditForm({...editForm,email:e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500"/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Giá trị ước tính (đ)</label><input value={editForm.value} onChange={e=>setEditForm({...editForm,value:e.target.value})} placeholder="VD: 150000000" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500"/></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Giới hạn nợ (đ)</label><input value={editForm.credit_limit} onChange={e=>setEditForm({...editForm,credit_limit:e.target.value})} placeholder="Để trống = không giới hạn" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500"/></div>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Hạng khách hàng</label>
                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(TIERS).map(([key,t])=>(
                    <button key={key} type="button" onClick={()=>setEditForm({...editForm,tier:key})} className={`p-2 rounded-xl border text-center text-xs font-bold transition-all ${editForm.tier===key?`${t.bg} ${t.color} ring-2 ring-offset-1 ring-indigo-500`:'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}><div className="text-lg mb-0.5">{t.icon}</div><div>{t.label}</div></button>
                  ))}
                </div>
              </div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ghi chú hạng</label><input value={editForm.tier_note} onChange={e=>setEditForm({...editForm,tier_note:e.target.value})} placeholder="VD: KH VIP từ 2023..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500"/></div>
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button type="button" onClick={()=>setEditModal(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Hủy</button>
                <button type="submit" disabled={savingEdit} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold flex items-center gap-2">{savingEdit?<><Loader2 size={14} className="animate-spin"/> Đang lưu...</>:<><Save size={14}/> Lưu</>}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL THANH TOÁN */}
      {payModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div><h3 className="font-bold text-slate-900">Ghi nhận thanh toán</h3><p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{payModal.title}</p></div>
              <button onClick={()=>setPayModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-3 gap-3 text-center">
                <div><p className="text-xs text-slate-400 font-bold">Tổng nợ</p><p className="text-sm font-black text-slate-900 mt-0.5">{fmt(Number(payModal.total_amount))}</p></div>
                <div><p className="text-xs text-slate-400 font-bold">Đã trả</p><p className="text-sm font-black text-emerald-600 mt-0.5">{fmt(Number(payModal.paid_amount))}</p></div>
                <div><p className="text-xs text-slate-400 font-bold">Còn lại</p><p className="text-sm font-black text-red-600 mt-0.5">{fmt(Number(payModal.remaining_amount))}</p></div>
              </div>
              {payHistory.length > 0 && (
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lịch sử thanh toán</p>
                  {payHistory.map((p:any)=>(
                    <div key={p.id} className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs">
                      <span className="text-slate-600">{new Date(p.paid_at).toLocaleDateString('vi-VN')} {p.note&&`— ${p.note}`}</span>
                      <span className="font-bold text-emerald-700">+{fmt(Number(p.amount))}</span>
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={handleAddPayment} className="space-y-3 pt-2 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Thêm đợt thanh toán mới</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs text-slate-500 mb-1">Số tiền (đ) *</label><input type="number" required min="0" value={payForm.amount} onChange={e=>setPayForm({...payForm,amount:e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500"/></div>
                  <div><label className="block text-xs text-slate-500 mb-1">Ngày thanh toán *</label><input type="date" required value={payForm.paid_at} onChange={e=>setPayForm({...payForm,paid_at:e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500"/></div>
                </div>
                <div><label className="block text-xs text-slate-500 mb-1">Ghi chú</label><input value={payForm.note} onChange={e=>setPayForm({...payForm,note:e.target.value})} placeholder="Chuyển khoản, tiền mặt..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500"/></div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={()=>setPayModal(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Đóng</button>
                  <button type="submit" disabled={payingSaving} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold flex items-center gap-2">{payingSaving?<><Loader2 size={14} className="animate-spin"/> Đang lưu...</>:<><CreditCard size={14}/> Ghi nhận</>}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {adjustModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900">Điều chỉnh bút toán</h3>
              <button onClick={()=>setAdjustModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-slate-500 font-bold mb-1.5">Công nợ có thừa *</label>
                <select value={adjustForm.from_debt_id} onChange={e=>setAdjustForm({...adjustForm,from_debt_id:e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500">
                  <option value="">-- Chọn công nợ --</option>
                  {debts.map(d=>{
                    const remaining = Number(d.total_amount) - Number(d.paid_amount);
                    if (remaining >= 0) return null;
                    return <option key={d.id} value={d.id}>{d.title} (thừa {fmt(Math.abs(remaining))})</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-bold mb-1.5">Công nợ cần bù *</label>
                <select value={adjustForm.to_debt_id} onChange={e=>setAdjustForm({...adjustForm,to_debt_id:e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500">
                  <option value="">-- Chọn công nợ --</option>
                  {debts.map(d=>{
                    const remaining = Number(d.total_amount) - Number(d.paid_amount);
                    if (remaining <= 0 || d.id === parseInt(adjustForm.from_debt_id || '0')) return null;
                    return <option key={d.id} value={d.id}>{d.title} (còn {fmt(remaining)})</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-bold mb-1.5">Số tiền điều chỉnh (đ) *</label>
                <input type="number" min="0" value={adjustForm.amount} onChange={e=>setAdjustForm({...adjustForm,amount:e.target.value})} placeholder="0" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500"/>
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-bold mb-1.5">Ghi chú</label>
                <input value={adjustForm.note} onChange={e=>setAdjustForm({...adjustForm,note:e.target.value})} placeholder="Lý do điều chỉnh..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500"/>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button onClick={()=>setAdjustModal(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Hủy</button>
                <button onClick={handleAdjust} disabled={savingAdjust} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold flex items-center gap-2">{savingAdjust?<><Loader2 size={14} className="animate-spin"/> Đang lưu...</>:<><Save size={14}/> Xác nhận</>}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page({ params }: { params: any }) {
  return <AuthGuard><CustomerDetailPage params={params} /></AuthGuard>;
}