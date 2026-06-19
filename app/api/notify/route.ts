import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { PrismaClient } from '@prisma/client';

const resend = new Resend(process.env.RESEND_API_KEY);
const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET() {
  const today = new Date();
  const in2Days = new Date(today);
  in2Days.setDate(today.getDate() + 2);

  // ── 1. Tasks sắp đến hạn (trong vòng 2 ngày) ──
  const urgentTasks = await prisma.task.findMany({
    where: {
      isCompleted: false,
      dueDate: {
        lte: in2Days.toISOString().slice(0, 10),
        gte: today.toISOString().slice(0, 10),
      }
    },
    include: { customer: { select: { name: true } } }
  });

  // ── 2. KH lâu không liên hệ (không có interaction trong 14 ngày) ──
  const ago14 = new Date(today);
  ago14.setDate(today.getDate() - 14);

  const allCustomers = await prisma.customer.findMany({
    where: { status: { notIn: ['Thành công', 'Thất bại'] } },
    include: {
      interactions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      }
    }
  });

  const neglectedCustomers = allCustomers.filter(c => {
    if (c.interactions.length === 0) return true;
    return new Date(c.interactions[0].createdAt) < ago14;
  });

  // ── Không có gì để báo ──
  if (urgentTasks.length === 0 && neglectedCustomers.length === 0) {
    return NextResponse.json({ message: 'Không có thông báo cần gửi.' });
  }

  // ── Soạn email HTML ──
  const taskRows = urgentTasks.map(t =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${t.customer?.name ?? '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${t.title}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#ef4444;font-weight:bold;">${t.dueDate}</td>
    </tr>`
  ).join('');

  const neglectedRows = neglectedCustomers.map(c => {
    const lastContact = c.interactions[0]
      ? new Date(c.interactions[0].createdAt).toLocaleDateString('vi-VN')
      : 'Chưa từng liên hệ';
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${c.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${c.company}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#f59e0b;font-weight:bold;">${lastContact}</td>
    </tr>`;
  }).join('');

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
      <div style="background:#4f46e5;padding:24px;border-radius:12px 12px 0 0;">
        <h1 style="color:white;margin:0;font-size:20px;">📋 Báo cáo nhắc việc hàng ngày</h1>
        <p style="color:#c7d2fe;margin:4px 0 0;font-size:13px;">
          Việt Xô CRM — ${today.toLocaleDateString('vi-VN')}
        </p>
      </div>

      <div style="background:white;padding:24px;border:1px solid #e2e8f0;border-top:none;">

        ${urgentTasks.length > 0 ? `
        <h2 style="font-size:15px;color:#ef4444;margin:0 0 12px;">
          🔴 Tasks sắp đến hạn (${urgentTasks.length})
        </h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
          <thead>
            <tr style="background:#fef2f2;">
              <th style="padding:8px 12px;text-align:left;color:#94a3b8;font-size:11px;text-transform:uppercase;">Khách hàng</th>
              <th style="padding:8px 12px;text-align:left;color:#94a3b8;font-size:11px;text-transform:uppercase;">Công việc</th>
              <th style="padding:8px 12px;text-align:left;color:#94a3b8;font-size:11px;text-transform:uppercase;">Hạn chót</th>
            </tr>
          </thead>
          <tbody>${taskRows}</tbody>
        </table>
        ` : ''}

        ${neglectedCustomers.length > 0 ? `
        <h2 style="font-size:15px;color:#f59e0b;margin:0 0 12px;">
          ⚠️ Khách hàng lâu chưa liên hệ (${neglectedCustomers.length})
        </h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#fffbeb;">
              <th style="padding:8px 12px;text-align:left;color:#94a3b8;font-size:11px;text-transform:uppercase;">Tên KH</th>
              <th style="padding:8px 12px;text-align:left;color:#94a3b8;font-size:11px;text-transform:uppercase;">Công ty</th>
              <th style="padding:8px 12px;text-align:left;color:#94a3b8;font-size:11px;text-transform:uppercase;">Liên hệ gần nhất</th>
            </tr>
          </thead>
          <tbody>${neglectedRows}</tbody>
        </table>
        ` : ''}

        <div style="margin-top:24px;padding-top:16px;border-top:1px solid #f1f5f9;text-align:center;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/customers"
            style="background:#4f46e5;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px;">
            Mở CRM Portal →
          </a>
        </div>
      </div>
    </div>
  `;

  await resend.emails.send({
    from: 'Việt Xô CRM <onboarding@resend.dev>',
    to: process.env.NOTIFY_EMAIL!,
    subject: `[CRM] ${urgentTasks.length} task sắp hạn · ${neglectedCustomers.length} KH chưa liên hệ — ${today.toLocaleDateString('vi-VN')}`,
    html,
  });

  return NextResponse.json({
    sent: true,
    urgentTasks: urgentTasks.length,
    neglectedCustomers: neglectedCustomers.length,
  });
}