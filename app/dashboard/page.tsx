'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Loader2, Users, TrendingUp, Target, DollarSign, ArrowLeft, Download } from 'lucide-react';
import { exportAnalyticsToExcel, exportAnalyticsToPDF } from '@/lib/export/exportUtils';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import AuthGuard from '@/components/AuthGuard';

const ALL_STATUSES = ['Tiếp cận', 'Đang đàm phán', 'Báo giá', 'Thành công', 'Tạm dừng', 'Thất bại'];

const STATUS_COLORS: Record<string, string> = {
  'Tiếp cận': '#6366f1', 'Đang đàm phán': '#f59e0b',
  'Báo giá': '#a855f7', 'Thành công': '#10b981',
  'Tạm dừng': '#94a3b8', 'Thất bại': '#ef4444',
};

const formatVND = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)} tr`;
  return `${value.toLocaleString('vi-VN')}đ`;
};

const CustomLegend = ({ payload, total }: { payload?: any[]; total: number }) => (
  <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
    {(payload || []).map((entry: any) => {
      const pct = total > 0 ? Math.round((entry.payload.value / total) * 100) : 0;
      return (
        <div key={entry.value} className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="font-medium">{entry.value}</span>
          <span className="text-slate-400">— {entry.payload.value} KH ({pct}%)</span>
        </div>
      );
    })}
  </div>
);

function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    fetchWithAuth('/api/analytics')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!showExport) return;
    const handler = () => setShowExport(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showExport]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="animate-spin text-indigo-600" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Dashboard Analytics</h1>
            <p className="text-sm text-slate-400 mt-1">Tổng quan hiệu suất kinh doanh</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setShowExport(v => !v); }} className="flex items-center gap-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-xl transition-colors">
                <Download size={16} /><span className="hidden sm:inline">Xuất báo cáo</span>
              </button>
              {showExport && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden w-52" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { exportAnalyticsToExcel(data); setShowExport(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700">📊 Xuất Excel (3 sheets)</button>
                  <button onClick={() => { exportAnalyticsToPDF(data); setShowExport(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700">📄 Xuất PDF đầy đủ</button>
                </div>
              )}
            </div>
            <button onClick={() => router.push('/customers')} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 border border-slate-200 bg-white px-4 py-2.5 rounded-xl transition-colors">
              <ArrowLeft size={16} /><span className="hidden sm:inline">Quay lại CRM</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Tổng khách hàng',    value: data?.totalCustomers ?? 0,        icon: <Users size={20} />,      color: 'text-indigo-600',  bg: 'bg-indigo-50' },
            { label: 'Tổng giá trị',        value: formatVND(data?.totalValue ?? 0), icon: <DollarSign size={20} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Đã chốt thành công', value: data?.successCustomers ?? 0,       icon: <Target size={20} />,     color: 'text-purple-600',  bg: 'bg-purple-50' },
            { label: 'Tỷ lệ chốt',          value: `${data?.successRate ?? 0}%`,      icon: <TrendingUp size={20} />, color: 'text-amber-600',   bg: 'bg-amber-50' },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
              <div className={`${kpi.bg} ${kpi.color} p-3 rounded-xl`}>{kpi.icon}</div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{kpi.label}</p>
                <p className={`text-xl font-black mt-0.5 ${kpi.color}`}>{kpi.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-bold text-slate-800 mb-4">Phân bổ Pipeline (8 Giai Đoạn)</h2>
          <div className="space-y-3">
            {data?.pipelineBreakdown?.map((stage: any) => {
              const pct = data?.totalCustomers > 0 ? Math.round((stage.value / data.totalCustomers) * 100) : 0;
              const colors: Record<string, string> = {
                'Tiếp cận': '#64748b',
                'Khảo sát': '#3b82f6',
                'Báo giá': '#a855f7',
                'Đàm phán': '#f59e0b',
                'Lên đơn': '#6366f1',
                'Giao hàng': '#f97316',
                'Thu tiền': '#f43f5e',
                'Hoàn thành': '#10b981',
              };
              return (
                <div key={stage.key} className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-slate-600 w-32 shrink-0">{stage.label}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-3">
                    <div className="h-3 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: colors[stage.label] || '#94a3b8' }} />
                  </div>
                  <span className="text-sm font-bold text-slate-700 w-8 text-right">{stage.value}</span>
                  <span className="text-xs text-slate-400 w-12 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-bold text-slate-800 mb-4">Giá trị hợp đồng theo tháng</h2>
            {data?.revenueChart?.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.revenueChart} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tickFormatter={formatVND} tick={{ fontSize: 11, fill: '#94a3b8' }} width={60} />
                  <Tooltip formatter={(v: any) => [formatVND(v), 'Giá trị']} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">Chưa có dữ liệu</div>}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-bold text-slate-800 mb-4">Phân bổ theo trạng thái</h2>
            {data?.statusBreakdown?.some((s: any) => s.value > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={data.statusBreakdown.filter((s: any) => s.value > 0)} cx="50%" cy="42%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value" label={false} labelLine={false}>
                    {data.statusBreakdown.map((entry: any) => <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />)}
                  </Pie>
                  <Tooltip formatter={(v: any, name: any) => [v + ' khách hàng', name]} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend content={<CustomLegend total={data.totalCustomers} />} verticalAlign="bottom" />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">Chưa có dữ liệu</div>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-bold text-slate-800 mb-4">Pipeline theo giai đoạn</h2>
          <div className="space-y-3">
            {ALL_STATUSES.map(stage => {
              const count = data?.statusBreakdown?.find((s: any) => s.name === stage)?.value ?? 0;
              const pct = data?.totalCustomers > 0 ? Math.round((count / data.totalCustomers) * 100) : 0;
              return (
                <div key={stage} className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-slate-600 w-36 shrink-0">{stage}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2.5">
                    <div className="h-2.5 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[stage] }} />
                  </div>
                  <span className="text-sm font-bold text-slate-700 w-6 text-right">{count}</span>
                  <span className="text-xs text-slate-400 w-10 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <AuthGuard><DashboardPage /></AuthGuard>;
}