'use client';

import { exportCustomersToExcel, exportCustomersToPDF } from '@/lib/export/exportUtils';
import { Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Plus, Building2, ChevronRight, Loader2, Filter,
  Phone, Mail, X, LayoutGrid, List, LogOut, BarChart2, FileText, Banknote
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import AuthGuard from '@/components/AuthGuard';

interface Customer {
  id: number;
  name: string;
  company: string;
  phone: string;
  email: string;
  value: string;
  status: string;
  createdAt: string;
}

const ALL_STATUSES = ['Tiếp cận', 'Đang đàm phán', 'Báo giá', 'Thành công', 'Tạm dừng', 'Thất bại'];

const STATUS_COLORS: Record<string, string> = {
  'Tiếp cận':      '#6366f1',
  'Đang đàm phán': '#f59e0b',
  'Báo giá':       '#a855f7',
  'Thành công':    '#10b981',
  'Tạm dừng':      '#94a3b8',
  'Thất bại':      '#ef4444',
};

const getStatusStyle = (status: string) => {
  switch (status?.trim()) {
    case 'Thành công':    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Đang đàm phán': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Báo giá':       return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'Tạm dừng':      return 'bg-slate-100 text-slate-600 border-slate-300';
    case 'Thất bại':      return 'bg-red-50 text-red-600 border-red-200';
    default:              return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  }
};

function CRMPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [formData, setFormData] = useState({
    name: '', company: '', phone: '', email: '', value: '', status: 'Tiếp cận'
  });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth('/api/customers');
      const data = await res.json();
      if (Array.isArray(data)) setCustomers(data);
    } catch (error) {
      console.error('Lỗi tải danh sách khách hàng:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth('/api/customers', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setFormData({ name: '', company: '', phone: '', email: '', value: '', status: 'Tiếp cận' });
        fetchCustomers();
        alert('Đã thêm khách hàng thành công! 🎉');
      } else {
        alert('Có lỗi xảy ra khi lưu.');
      }
    } catch (err) {
      alert('Lỗi kết nối API: ' + err);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const q = searchTerm.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q);
  });

  const totalCustomers = customers.length;
  const totalValue = customers.reduce((sum, c) => {
    const n = parseInt((c.value || '').replace(/[^0-9]/g, ''), 10);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);
  const successCustomers = customers.filter(c => c.status?.trim() === 'Thành công').length;
  const successRate = totalCustomers > 0 ? Math.round((successCustomers / totalCustomers) * 100) : 0;

  const formatVND = (value: number | string) => {
    if (!value) return '0 đ';
    const n = parseInt(String(value).replace(/[^0-9]/g, ''), 10);
    if (isNaN(n)) return '0 đ';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n).replace('₫', 'đ');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">Việt Xô CRM Portal</h1>
            <p className="text-sm text-slate-400 mt-1">Hệ thống quản lý thông tin và chăm sóc khách hàng</p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-center flex-wrap">

            {/* Dashboard */}
            <button onClick={() => router.push('/dashboard')}
              className="border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 text-slate-500 text-sm font-semibold px-3 py-2.5 rounded-xl flex items-center gap-2 transition-all">
              <BarChart2 size={16} /><span className="hidden sm:inline">Dashboard</span>
            </button>

            {/* Báo giá */}
            <button onClick={() => router.push('/quotations')}
              className="border border-slate-200 bg-white hover:bg-purple-50 hover:border-purple-200 hover:text-purple-600 text-slate-500 text-sm font-semibold px-3 py-2.5 rounded-xl flex items-center gap-2 transition-all">
              <FileText size={16} /><span className="hidden sm:inline">Báo giá</span>
            </button>

            {/* Công nợ — NÚT MỚI */}
            <button onClick={() => router.push('/debts')}
              className="border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-slate-500 text-sm font-semibold px-3 py-2.5 rounded-xl flex items-center gap-2 transition-all">
              <Banknote size={16} /><span className="hidden sm:inline">Công nợ</span>
            </button>

            {/* Thêm KH */}
            <button onClick={() => setIsModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-100 transition-all active:scale-95">
              <Plus size={16} /> Thêm khách hàng mới
            </button>

            {/* Đăng xuất */}
            <button onClick={handleLogout} title="Đăng xuất"
              className="border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-slate-500 text-sm font-semibold px-3 py-2.5 rounded-xl flex items-center gap-2 transition-all">
              <LogOut size={16} /><span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>

        {/* Thẻ thống kê */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            { label: 'Tổng số khách hàng', value: totalCustomers, color: 'text-slate-900', emoji: '👥 Khách', bg: 'bg-blue-50 text-blue-600' },
            { label: 'Tổng giá trị dự kiến', value: formatVND(totalValue), color: 'text-indigo-600', emoji: '💰 Doanh số', bg: 'bg-indigo-50 text-indigo-600' },
            { label: 'Tỷ lệ chốt thành công', value: `${successRate}%`, color: 'text-emerald-600', emoji: '🎯 Tỷ lệ', bg: 'bg-emerald-50 text-emerald-600' },
          ].map(card => (
            <div key={card.label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{card.label}</span>
                <span className={`text-2xl font-black block mt-1 ${card.color}`}>{card.value}</span>
              </div>
              <div className={`p-3 rounded-xl text-xs ${card.bg}`}>{card.emoji}</div>
            </div>
          ))}
        </div>

        {/* Thanh công cụ */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tìm kiếm theo tên hoặc tên công ty..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700" />
          </div>
          <div className="flex gap-3 w-full md:w-auto items-center justify-end">
            <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200">
              <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                <List size={14} /> Dạng Bảng
              </button>
              <button onClick={() => setViewMode('kanban')} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${viewMode === 'kanban' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                <LayoutGrid size={14} /> Dạng Phễu
              </button>
            </div>
            <div className="relative">
              <button onClick={() => setShowExport(!showExport)} className="border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm">
                <Download size={14} /> Xuất file
              </button>
              {showExport && (
                <div className="absolute right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden w-44">
                  <button onClick={() => { exportCustomersToExcel(filteredCustomers); setShowExport(false); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2">📊 Xuất Excel (.xlsx)</button>
                  <button onClick={() => { exportCustomersToPDF(filteredCustomers); setShowExport(false); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2">📄 Xuất PDF báo cáo</button>
                </div>
              )}
            </div>
            <button className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm">
              <Filter size={14} /> Bộ lọc
            </button>
          </div>
        </div>

        {/* Nội dung */}
        {viewMode === 'table' ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <th className="py-4 px-6">Khách hàng / Doanh nghiệp</th>
                    <th className="py-4 px-6 hidden md:table-cell">Thông tin liên hệ</th>
                    <th className="py-4 px-6 text-center">Trạng thái</th>
                    <th className="py-4 px-6 text-right">Giá trị dự kiến</th>
                    <th className="py-4 px-6 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.length === 0 ? (
                    <tr><td colSpan={5} className="py-12 text-center text-slate-400 text-sm italic">Chưa có dữ liệu hoặc không tìm thấy khách hàng phù hợp.</td></tr>
                  ) : filteredCustomers.map(customer => (
                    <tr key={customer.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-900">{customer.name}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-1"><Building2 size={12} /> {customer.company}</div>
                      </td>
                      <td className="py-4 px-6 text-sm text-slate-500 hidden md:table-cell">
                        <div className="flex items-center gap-1.5"><Phone size={13} className="text-slate-400" /> {customer.phone}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-1"><Mail size={13} className="text-slate-400" /> {customer.email}</div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getStatusStyle(customer.status)}`}>{customer.status}</span>
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-slate-900 text-sm">{formatVND(customer.value)}</td>
                      <td className="py-4 px-6 text-right">
                        <button onClick={() => router.push(`/customers/${customer.id}`)} className="text-slate-400 hover:text-indigo-600 p-1 rounded-lg hover:bg-indigo-50 transition-colors">
                          <ChevronRight size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 pb-4">
            {ALL_STATUSES.map(stage => {
              const stageCustomers = filteredCustomers.filter(c => c.status?.trim() === stage);
              return (
                <div key={stage} className="bg-slate-100/80 rounded-2xl p-4 border border-slate-200 flex flex-col h-fit max-h-[70vh]">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[stage] }} />
                      <span className="font-bold text-xs text-slate-700">{stage}</span>
                    </div>
                    <span className="bg-slate-200 text-slate-600 text-xs font-extrabold px-2 py-0.5 rounded-full">{stageCustomers.length}</span>
                  </div>
                  <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                    {stageCustomers.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-white/40">Trống</div>
                    ) : stageCustomers.map(customer => (
                      <div key={customer.id} onClick={() => router.push(`/customers/${customer.id}`)} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group">
                        <div className="font-semibold text-slate-900 text-xs group-hover:text-indigo-600 transition-colors leading-snug">{customer.name}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-1"><Building2 size={10} /> {customer.company}</div>
                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-black text-slate-700">{formatVND(customer.value)}</span>
                          <ChevronRight size={12} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal thêm KH */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900">Thêm khách hàng mới</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {[
                { label: 'Tên khách hàng *', key: 'name', type: 'text', required: true },
                { label: 'Tên công ty', key: 'company', type: 'text', required: false },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{f.label}</label>
                  <input type={f.type} required={f.required} value={(formData as any)[f.key]} onChange={e => setFormData({...formData, [f.key]: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Số điện thoại</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Giá trị hợp đồng (đ)</label>
                  <input type="text" placeholder="VD: 15000000" value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Trạng thái</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all">
                    {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium shadow-lg shadow-indigo-100">Lưu thông tin</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return <AuthGuard><CRMPage /></AuthGuard>;
}