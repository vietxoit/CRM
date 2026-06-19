import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ROBOTO_REGULAR, ROBOTO_BOLD } from './robotoFont';

// ============================================================
// HELPER: Đăng ký font Roboto vào jsPDF (tiếng Việt có dấu)
// ============================================================
function setupFont(doc: jsPDF) {
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR);
  doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
  doc.setFont('Roboto', 'normal');
}

const formatVND = (value: string | number) => {
  const num = parseInt(String(value).replace(/[^0-9]/g, ''), 10);
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('vi-VN').format(num) + 'đ';
};

// ============================================================
// XUẤT EXCEL (không đổi — Excel đã hỗ trợ Unicode sẵn)
// ============================================================

export function exportCustomersToExcel(customers: any[]) {
  const rows = customers.map((c, i) => ({
    'STT':             i + 1,
    'Tên khách hàng': c.name,
    'Công ty':        c.company,
    'Điện thoại':     c.phone,
    'Email':          c.email,
    'Trạng thái':     c.status,
    'Giá trị (đ)':    formatVND(c.value),
    'Ngày tạo':       new Date(c.createdAt).toLocaleDateString('vi-VN'),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 5 }, { wch: 25 }, { wch: 25 }, { wch: 15 },
    { wch: 28 }, { wch: 14 }, { wch: 20 }, { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh sách KH');
  XLSX.writeFile(wb, `danh-sach-khach-hang-${today()}.xlsx`);
}

export function exportAnalyticsToExcel(data: any) {
  const wb = XLSX.utils.book_new();

  const revenueRows = (data.revenueChart || []).map((r: any) => ({
    'Tháng':       r.month,
    'Giá trị (đ)': formatVND(r.value),
  }));
  const wsRevenue = XLSX.utils.json_to_sheet(revenueRows);
  wsRevenue['!cols'] = [{ wch: 18 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsRevenue, 'Doanh thu theo tháng');

  const pipelineRows = (data.statusBreakdown || []).map((s: any) => ({
    'Trạng thái':    s.name,
    'Số khách hàng': s.value,
    'Tỷ lệ (%)':    data.totalCustomers > 0
      ? Math.round((s.value / data.totalCustomers) * 100) + '%'
      : '0%',
  }));
  const wsPipeline = XLSX.utils.json_to_sheet(pipelineRows);
  wsPipeline['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsPipeline, 'Pipeline');

  const kpiRows = [
    { 'Chỉ số': 'Tổng khách hàng',    'Giá trị': data.totalCustomers },
    { 'Chỉ số': 'Đã chốt thành công', 'Giá trị': data.successCustomers },
    { 'Chỉ số': 'Tỷ lệ chốt',         'Giá trị': data.successRate + '%' },
    { 'Chỉ số': 'Tổng giá trị (đ)',   'Giá trị': formatVND(data.totalValue) },
  ];
  const wsKPI = XLSX.utils.json_to_sheet(kpiRows);
  wsKPI['!cols'] = [{ wch: 22 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsKPI, 'Tổng quan KPI');

  XLSX.writeFile(wb, `bao-cao-crm-${today()}.xlsx`);
}

// ============================================================
// XUẤT PDF — Dùng font Roboto để hiển thị tiếng Việt có dấu
// ============================================================

export function exportCustomersToPDF(customers: any[]) {
  const doc = new jsPDF({ orientation: 'landscape' });
  setupFont(doc);

  // Tiêu đề
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(16);
  doc.text('DANH SÁCH KHÁCH HÀNG', 14, 16);
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(10);
  doc.text(`Xuất ngày: ${new Date().toLocaleDateString('vi-VN')}`, 14, 23);

  autoTable(doc, {
    startY: 28,
    head: [['STT', 'Tên khách hàng', 'Công ty', 'Điện thoại', 'Email', 'Trạng thái', 'Giá trị']],
    body: customers.map((c, i) => [
      i + 1,
      c.name,
      c.company,
      c.phone,
      c.email,
      c.status,
      formatVND(c.value),
    ]),
    styles: {
      fontSize: 9,
      cellPadding: 3,
      font: 'Roboto',        // ← Dùng font Roboto
    },
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: 255,
      fontStyle: 'bold',
      font: 'Roboto',
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10 },
      6: { halign: 'right' },
    },
  });

  doc.save(`danh-sach-khach-hang-${today()}.pdf`);
}

export function exportAnalyticsToPDF(data: any) {
  const doc = new jsPDF();
  setupFont(doc);

  // Tiêu đề
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(18);
  doc.text('BÁO CÁO KINH DOANH CRM', 14, 18);
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(10);
  doc.text(`Việt Xô Steel  |  Xuất ngày: ${new Date().toLocaleDateString('vi-VN')}`, 14, 26);

  // Bảng KPI
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(12);
  doc.text('TỔNG QUAN KPI', 14, 36);

  autoTable(doc, {
    startY: 40,
    head: [['Chỉ số', 'Giá trị']],
    body: [
      ['Tổng khách hàng',    String(data.totalCustomers)],
      ['Đã chốt thành công', String(data.successCustomers)],
      ['Tỷ lệ chốt',         data.successRate + '%'],
      ['Tổng giá trị',       formatVND(data.totalValue)],
    ],
    styles: { fontSize: 10, font: 'Roboto' },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, font: 'Roboto' },
    columnStyles: { 1: { halign: 'right' } },
  });

  // Bảng Pipeline
  const afterKPI = (doc as any).lastAutoTable.finalY + 10;
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(12);
  doc.text('PIPELINE THEO TRẠNG THÁI', 14, afterKPI);

  autoTable(doc, {
    startY: afterKPI + 4,
    head: [['Trạng thái', 'Số KH', 'Tỷ lệ']],
    body: (data.statusBreakdown || []).map((s: any) => [
      s.name,
      s.value,
      data.totalCustomers > 0
        ? Math.round((s.value / data.totalCustomers) * 100) + '%'
        : '0%',
    ]),
    styles: { fontSize: 10, font: 'Roboto' },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, font: 'Roboto' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // Bảng doanh thu
  const afterPipeline = (doc as any).lastAutoTable.finalY + 10;
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(12);
  doc.text('DOANH THU THEO THÁNG', 14, afterPipeline);

  autoTable(doc, {
    startY: afterPipeline + 4,
    head: [['Tháng', 'Giá trị']],
    body: (data.revenueChart || []).map((r: any) => [r.month, formatVND(r.value)]),
    styles: { fontSize: 10, font: 'Roboto' },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, font: 'Roboto' },
    columnStyles: { 1: { halign: 'right' } },
  });

  doc.save(`bao-cao-crm-${today()}.pdf`);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}