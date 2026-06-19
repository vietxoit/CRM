import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ROBOTO_REGULAR, ROBOTO_BOLD } from '@/lib/export/robotoFont';

// Thêm import này:
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: any) {
  try {
    const { id } = await context.params;

    const quotation = await prisma.$queryRawUnsafe(`
      SELECT q.*, c.name as customer_name, c.company, c.phone, c.email as customer_email
      FROM quotations q
      LEFT JOIN "Customer" c ON c.id = q.customer_id
      WHERE q.id = $1
    `, parseInt(id)) as any[];

    if (!quotation.length) {
      return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 });
    }

    const items = await prisma.$queryRawUnsafe(`
      SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY id ASC
    `, parseInt(id)) as any[];

    const q = quotation[0];
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    // Đăng ký font Roboto tiếng Việt
    doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR);
    doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');

    const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' đ';
    const validUntil = new Date(q.created_at);
    validUntil.setDate(validUntil.getDate() + (parseInt(q.valid_days) || 7));

    // ── Header ──
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, pageW, 36, 'F');

    doc.setFont('Roboto', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('CÔNG TY CỔ PHẦN THÉP VIỆT XÔ', 14, 13);

    doc.setFont('Roboto', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(199, 210, 254);
    doc.text('Địa chỉ: 123 Đường Công Nghiệp, KCN Phố Nối, Hưng Yên', 14, 20);
    doc.text('Hotline: 1800 xxxx  |  Email: info@vietxo.com', 14, 26);

    doc.setFont('Roboto', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(q.quote_number, pageW - 14, 13, { align: 'right' });
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(8);
    doc.text(`Ngày: ${new Date(q.created_at).toLocaleDateString('vi-VN')}`, pageW - 14, 20, { align: 'right' });
    doc.text(`Hiệu lực: ${validUntil.toLocaleDateString('vi-VN')}`, pageW - 14, 26, { align: 'right' });

    // ── Tiêu đề ──
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(30, 41, 59);
    doc.text('BÁO GIÁ VẬT LIỆU THÉP', pageW / 2, 47, { align: 'center' });

    // ── Thông tin KH ──
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 53, pageW - 28, 28, 3, 3, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 53, pageW - 28, 28, 3, 3, 'S');

    doc.setFont('Roboto', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('KÍNH GỬI:', 18, 61);

    doc.setFont('Roboto', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(q.customer_name || '', 18, 68);

    doc.setFont('Roboto', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    if (q.company) doc.text(`Công ty: ${q.company}`, 18, 74);
    const contactInfo = [q.phone, q.customer_email].filter(Boolean).join('  |  ');
    if (contactInfo) doc.text(contactInfo, 18, 79);

    // ── Bảng sản phẩm ──
    const tableBody = (items as any[]).map((item: any, idx: number) => [
      idx + 1,
      item.product_name,
      item.unit || 'Tấn',
      new Intl.NumberFormat('vi-VN').format(item.quantity),
      fmt(parseFloat(item.unit_price)),
      fmt(parseFloat(item.quantity) * parseFloat(item.unit_price)),
    ]);

    const totalValue = (items as any[]).reduce((s: number, i: any) =>
      s + parseFloat(i.quantity) * parseFloat(i.unit_price), 0);

    autoTable(doc, {
      startY: 88,
      head: [['STT', 'Tên sản phẩm / Chủng loại', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền']],
      body: tableBody,
      foot: [['', '', '', '', 'TỔNG CỘNG:', fmt(totalValue)]],
      styles: { font: 'Roboto', fontSize: 9, cellPadding: 3 },
      headStyles: {
        fillColor: [79, 70, 229], textColor: 255,
        font: 'Roboto', fontStyle: 'bold', halign: 'center', fontSize: 8.5,
      },
      footStyles: {
        font: 'Roboto', fontStyle: 'bold',
        fillColor: [239, 246, 255], textColor: [30, 41, 59],
        fontSize: 10,
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        2: { halign: 'center', cellWidth: 16 },
        3: { halign: 'right', cellWidth: 24 },
        4: { halign: 'right', cellWidth: 34 },
        5: { halign: 'right', cellWidth: 34, fontStyle: 'bold' },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 8;

    // ── Ghi chú ──
    if (q.note) {
      doc.setFont('Roboto', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text('GHI CHÚ:', 14, finalY);
      doc.setFont('Roboto', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(q.note, 14, finalY + 5);
    }

    // ── Điều khoản ──
    const termsY = q.note ? finalY + 14 : finalY;
    doc.setFillColor(254, 252, 232);
    doc.roundedRect(14, termsY, pageW - 28, 24, 2, 2, 'F');
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(133, 77, 14);
    doc.text('ĐIỀU KHOẢN & LƯU Ý:', 18, termsY + 6);
    doc.setFont('Roboto', 'normal');
    doc.setTextColor(92, 64, 12);
    doc.text(`• Báo giá có hiệu lực ${q.valid_days || 7} ngày kể từ ngày phát hành.`, 18, termsY + 12);
    doc.text('• Giá trên chưa bao gồm VAT (10%). Giá có thể thay đổi theo biến động thị trường.', 18, termsY + 17);
    doc.text('• Thanh toán: 30% đặt cọc, 70% trước khi nhận hàng.', 18, termsY + 22);

    // ── Chữ ký ──
    const sigY = termsY + 34;
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('NHÂN VIÊN PHỤ TRÁCH', 45, sigY, { align: 'center' });
    doc.text('ĐẠI DIỆN CÔNG TY', pageW - 45, sigY, { align: 'center' });
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('(Ký, ghi rõ họ tên)', 45, sigY + 5, { align: 'center' });
    doc.text('(Ký, đóng dấu)', pageW - 45, sigY + 5, { align: 'center' });
    if (q.created_by) {
      doc.setFont('Roboto', 'bold');
      doc.setTextColor(79, 70, 229);
      doc.text(q.created_by, 45, sigY + 28, { align: 'center' });
    }

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${q.quote_number}.pdf"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}