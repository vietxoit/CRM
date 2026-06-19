import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { Resend } from 'resend';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ROBOTO_REGULAR, ROBOTO_BOLD } from '@/lib/export/robotoFont';

// Thêm import này:
import { prisma } from '@/lib/prisma';
const resend = new Resend(process.env.RESEND_API_KEY);
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: any) {
  try {
    const { id } = await context.params;
    const { customMessage } = await request.json();

    // Lấy dữ liệu báo giá
    const quotation = await prisma.$queryRawUnsafe(`
      SELECT q.*, c.name as customer_name, c.company, c.phone, c.email as customer_email
      FROM quotations q
      LEFT JOIN "Customer" c ON c.id = q.customer_id
      WHERE q.id = $1
    `, parseInt(id)) as any[];

    if (!quotation.length) {
      return NextResponse.json({ error: 'Không tìm thấy báo giá' }, { status: 404 });
    }

    const q = quotation[0];
    if (!q.customer_email) {
      return NextResponse.json({ error: 'Khách hàng chưa có email' }, { status: 400 });
    }

    const items = await prisma.$queryRawUnsafe(`
      SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY id ASC
    `, parseInt(id)) as any[];

    // Tạo PDF buffer
    const pdfBuffer = generatePDF(q, items);

    const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' đ';
    const totalValue = (items as any[]).reduce((s: number, i: any) =>
      s + parseFloat(i.quantity) * parseFloat(i.unit_price), 0);
    const validUntil = new Date(q.created_at);
    validUntil.setDate(validUntil.getDate() + (parseInt(q.valid_days) || 7));

    // Soạn email HTML
    const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
      <div style="background:#4f46e5;padding:28px 24px;border-radius:12px 12px 0 0;">
        <h1 style="color:white;margin:0;font-size:20px;">CÔNG TY CỔ PHẦN THÉP VIỆT XÔ</h1>
        <p style="color:#c7d2fe;margin:6px 0 0;font-size:13px;">Báo giá vật liệu thép</p>
      </div>

      <div style="background:white;padding:28px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
        <p style="font-size:15px;margin:0 0 16px;">Kính gửi <strong>${q.customer_name}</strong>,</p>

        ${customMessage ? `<p style="font-size:14px;color:#475569;line-height:1.6;">${customMessage}</p>` : `
        <p style="font-size:14px;color:#475569;line-height:1.6;">
          Trân trọng gửi đến Quý khách báo giá vật liệu thép số <strong>${q.quote_number}</strong>.
          Chúng tôi hy vọng báo giá này phù hợp với nhu cầu của Quý khách.
        </p>`}

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr>
              <td style="padding:4px 0;color:#94a3b8;width:140px;">Số báo giá:</td>
              <td style="padding:4px 0;font-weight:bold;color:#4f46e5;">${q.quote_number}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#94a3b8;">Ngày phát hành:</td>
              <td style="padding:4px 0;">${new Date(q.created_at).toLocaleDateString('vi-VN')}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#94a3b8;">Hiệu lực đến:</td>
              <td style="padding:4px 0;color:#ef4444;font-weight:bold;">${validUntil.toLocaleDateString('vi-VN')}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#94a3b8;">Tổng giá trị:</td>
              <td style="padding:4px 0;font-weight:bold;font-size:15px;color:#10b981;">${fmt(totalValue)}</td>
            </tr>
          </table>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;">
          <thead>
            <tr style="background:#4f46e5;color:white;">
              <th style="padding:8px 12px;text-align:left;border-radius:6px 0 0 6px;">Sản phẩm</th>
              <th style="padding:8px 12px;text-align:center;">SL</th>
              <th style="padding:8px 12px;text-align:right;">Đơn giá</th>
              <th style="padding:8px 12px;text-align:right;border-radius:0 6px 6px 0;">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${(items as any[]).map((item: any, idx: number) => `
            <tr style="background:${idx % 2 === 0 ? '#f8fafc' : 'white'};">
              <td style="padding:8px 12px;">${item.product_name}</td>
              <td style="padding:8px 12px;text-align:center;">${item.quantity} ${item.unit}</td>
              <td style="padding:8px 12px;text-align:right;">${fmt(parseFloat(item.unit_price))}</td>
              <td style="padding:8px 12px;text-align:right;font-weight:bold;">${fmt(parseFloat(item.quantity) * parseFloat(item.unit_price))}</td>
            </tr>`).join('')}
            <tr style="background:#eff6ff;font-weight:bold;">
              <td colspan="3" style="padding:10px 12px;text-align:right;color:#4f46e5;">TỔNG CỘNG:</td>
              <td style="padding:10px 12px;text-align:right;color:#4f46e5;font-size:15px;">${fmt(totalValue)}</td>
            </tr>
          </tbody>
        </table>

        <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:12px;color:#92400e;margin:16px 0;">
          ⚠️ Báo giá có hiệu lực đến <strong>${validUntil.toLocaleDateString('vi-VN')}</strong>.
          Giá chưa bao gồm VAT (10%). Liên hệ ngay để được hỗ trợ!
        </div>

        <p style="font-size:13px;color:#64748b;margin:20px 0 4px;">Trân trọng,</p>
        <p style="font-size:14px;font-weight:bold;margin:0;">${q.created_by || 'Đội kinh doanh Việt Xô'}</p>
        <p style="font-size:12px;color:#94a3b8;margin:4px 0;">Công ty Cổ phần Thép Việt Xô</p>
        <p style="font-size:12px;color:#94a3b8;margin:4px 0;">Hotline: 1800 xxxx | info@vietxo.com</p>
      </div>
    </div>`;

    // Gửi email với PDF đính kèm
    await resend.emails.send({
      from: 'Viet Xo Steel <baogia@vietxosteel.vn>',
      to: q.customer_email,
      replyTo: 'vietxo.it@gmail.com',
      subject: `[Báo giá] ${q.quote_number} - Vật liệu thép Việt Xô`,
      html,
      attachments: [{
        filename: `${q.quote_number}.pdf`,
        content: pdfBuffer,
      }],
    });

    // Cập nhật trạng thái sang "sent"
    await prisma.$executeRawUnsafe(`
      UPDATE quotations SET status = 'sent', sent_at = NOW() WHERE id = $1
    `, parseInt(id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function generatePDF(q: any, items: any[]): Buffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR);
  doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');

  const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' đ';
  const validUntil = new Date(q.created_at);
  validUntil.setDate(validUntil.getDate() + (parseInt(q.valid_days) || 7));

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

  doc.setFont('Roboto', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(30, 41, 59);
  doc.text('BÁO GIÁ VẬT LIỆU THÉP', pageW / 2, 47, { align: 'center' });

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
  if (q.phone) doc.text(`ĐT: ${q.phone}  |  Email: ${q.customer_email || ''}`, 18, 79);

  const tableBody = items.map((item: any, idx: number) => [
    idx + 1, item.product_name, item.unit || 'Tấn',
    new Intl.NumberFormat('vi-VN').format(item.quantity),
    fmt(parseFloat(item.unit_price)),
    fmt(parseFloat(item.quantity) * parseFloat(item.unit_price)),
  ]);
  const totalValue = items.reduce((s: number, i: any) =>
    s + parseFloat(i.quantity) * parseFloat(i.unit_price), 0);

  autoTable(doc, {
    startY: 88,
    head: [['STT', 'Tên sản phẩm / Chủng loại', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền']],
    body: tableBody,
    foot: [['', '', '', '', 'TỔNG CỘNG:', fmt(totalValue)]],
    styles: { font: 'Roboto', fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, font: 'Roboto', fontStyle: 'bold', halign: 'center' },
    footStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [239, 246, 255], textColor: [30, 41, 59], fontSize: 10 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'right', cellWidth: 24 },
      4: { halign: 'right', cellWidth: 34 },
      5: { halign: 'right', cellWidth: 34, fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  return Buffer.from(doc.output('arraybuffer'));
}