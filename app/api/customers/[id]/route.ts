export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/getUser';
import { prisma } from '@/lib/prisma';

function calcRecommendation(stats: {
  totalDebts: number;
  overdueDebts: number;
  paidOnTime: number;
  totalPaid: number;
  remainingValue: number;
  creditLimit: number;
  daysSinceLastContact: number;
  currentTier: string;
}): { recommendation: string; suggestedTier: string | null; reasons: string[] } {
  const reasons: string[] = [];
  let suggestedTier: string | null = null;

  if (stats.overdueDebts > 0) {
    reasons.push(`⚠️ Có ${stats.overdueDebts} khoản nợ quá hạn — cần đôn đốc thanh toán`);
    suggestedTier = 'caution';
  }
  if (stats.creditLimit > 0 && stats.remainingValue > stats.creditLimit) {
    reasons.push(`🚨 Công nợ vượt giới hạn — tạm dừng cung cấp hàng hoá`);
    suggestedTier = 'caution';
  }
  if (stats.paidOnTime >= 3 && stats.overdueDebts === 0 && stats.totalPaid > 0) {
    reasons.push(`✅ Đã thanh toán đúng hạn ${stats.paidOnTime} lần — khách hàng uy tín`);
    if (stats.currentTier === 'normal') suggestedTier = 'priority';
    if (stats.currentTier === 'priority') suggestedTier = 'vip';
  }
  if (stats.totalPaid >= 500_000_000) {
    reasons.push(`💰 Tổng doanh số trên 500 triệu — xem xét nâng VIP`);
    if (!suggestedTier || suggestedTier === 'priority') suggestedTier = 'vip';
  }
  if (stats.daysSinceLastContact > 30) {
    reasons.push(`📅 Chưa liên hệ ${stats.daysSinceLastContact} ngày — cần chủ động chăm sóc`);
  } else if (stats.daysSinceLastContact > 14) {
    reasons.push(`📅 Chưa liên hệ ${stats.daysSinceLastContact} ngày — nên liên hệ sớm`);
  }
  if (stats.totalDebts === 0) {
    reasons.push(`💡 Chưa có đơn hàng — cần tư vấn và chào hàng`);
  }

  const recommendation = reasons.length === 0
    ? '✨ Khách hàng ổn định, duy trì chăm sóc định kỳ'
    : reasons.join('\n');

  return { recommendation, suggestedTier, reasons };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resolvedParams = await context.params;
    const customerId = parseInt(resolvedParams.id, 10);
    if (isNaN(customerId)) return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });

    const customers = await prisma.$queryRawUnsafe(`
      SELECT * FROM "Customer" WHERE id = $1
    `, customerId) as any[];

    if (!customers.length) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 });
    const customer = customers[0];

    if (user.role !== 'admin' && customer.assigned_to !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const debtStats = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*) as total_debts,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_debts,
        COALESCE(SUM(total_amount), 0) as completed_value,
        COALESCE(SUM(paid_amount), 0) as paid_value
      FROM debts WHERE customer_id = $1
    `, customerId) as any[];

    const onTimePayments = await prisma.$queryRawUnsafe(`
      SELECT COUNT(DISTINCT d.id) as count
      FROM debts d
      WHERE d.customer_id = $1
        AND d.status = 'paid'
        AND d.paid_amount >= d.total_amount
    `, customerId) as any[];

    const lastContact = await prisma.$queryRawUnsafe(`
      SELECT MAX("createdAt") as last_date
      FROM "Interaction" WHERE "customerId" = $1
    `, customerId) as any[];

    const ds = debtStats[0];
    const completedValue = parseFloat(ds.completed_value) || 0;
    const paidValue = parseFloat(ds.paid_value) || 0;
    const remainingValue = completedValue - paidValue; // có thể âm nếu trả thừa
    const creditLimit = parseFloat(String(customer.credit_limit || 0));
    const creditWarning = creditLimit > 0 && remainingValue > creditLimit;
    const creditUsedPct = creditLimit > 0 ? Math.round((remainingValue / creditLimit) * 100) : 0;

    const lastDate = lastContact[0]?.last_date;
    const daysSinceLastContact = lastDate
      ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000)
      : 999;

    const { recommendation, suggestedTier, reasons } = calcRecommendation({
      totalDebts: parseInt(ds.total_debts) || 0,
      overdueDebts: parseInt(ds.overdue_debts) || 0,
      paidOnTime: parseInt(onTimePayments[0]?.count) || 0,
      totalPaid: parseFloat(ds.paid_value) || 0,
      remainingValue,
      creditLimit,
      daysSinceLastContact,
      currentTier: customer.tier || 'normal',
    });

    return NextResponse.json({
      ...customer,
      completed_value: String(completedValue),
      paid_value: String(paidValue),
      remaining_value: String(remainingValue),
      credit_warning: creditWarning,
      credit_used_pct: creditUsedPct,
      recommendation,
      suggested_tier: suggestedTier,
      reasons,
      days_since_last_contact: daysSinceLastContact,
    });
  } catch (error: any) {
    console.error('CUSTOMER GET ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resolvedParams = await context.params;
    const customerId = parseInt(resolvedParams.id, 10);
    if (isNaN(customerId)) return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });

    const body = await request.json();
    const { status, name, company, phone, email, value, credit_limit, tier, tier_note, pipeline, order_status } = body;

    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (status        !== undefined) { setClauses.push(`status = $${idx++}`);        values.push(status.trim()); }
    if (name          !== undefined) { setClauses.push(`name = $${idx++}`);           values.push(name.trim()); }
    if (company       !== undefined) { setClauses.push(`company = $${idx++}`);        values.push(company.trim()); }
    if (phone         !== undefined) { setClauses.push(`phone = $${idx++}`);          values.push(phone.trim()); }
    if (email         !== undefined) { setClauses.push(`email = $${idx++}`);          values.push(email.trim()); }
    if (value         !== undefined) { setClauses.push(`value = $${idx++}`);          values.push(value.trim()); }
    if (credit_limit  !== undefined) { setClauses.push(`credit_limit = $${idx++}`);   values.push(parseFloat(credit_limit) || 0); }
    if (tier          !== undefined) { setClauses.push(`tier = $${idx++}`);           values.push(tier); }
    if (tier_note     !== undefined) { setClauses.push(`tier_note = $${idx++}`);      values.push(tier_note); }
    if (pipeline      !== undefined) { setClauses.push(`pipeline = $${idx++}`);       values.push(pipeline); }
    if (order_status  !== undefined) { setClauses.push(`order_status = $${idx++}`);   values.push(order_status); }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'Không có thông tin cần cập nhật' }, { status: 400 });
    }

    values.push(customerId);
    await prisma.$executeRawUnsafe(
      `UPDATE "Customer" SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      ...values
    );

    const updated = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Customer" WHERE id = $1`, customerId
    ) as any[];

    const debtStats = await prisma.$queryRawUnsafe(`
      SELECT
        COALESCE(SUM(total_amount), 0) as completed_value,
        COALESCE(SUM(paid_amount), 0) as paid_value
      FROM debts WHERE customer_id = $1
    `, customerId) as any[];

    const ds = debtStats[0];
    const completedValueNew = parseFloat(ds.completed_value) || 0;
    const paidValueNew = parseFloat(ds.paid_value) || 0;
    const remainingValueNew = completedValueNew - paidValueNew; // có thể âm nếu trả thừa
    const creditLimitNew = parseFloat(String(updated[0].credit_limit || 0));

    return NextResponse.json({
      ...updated[0],
      completed_value: String(completedValueNew),
      paid_value: String(paidValueNew),
      remaining_value: String(remainingValueNew),
      credit_warning: creditLimitNew > 0 && remainingValueNew > creditLimitNew,
      credit_used_pct: creditLimitNew > 0 ? Math.round((remainingValueNew / creditLimitNew) * 100) : 0,
    });
  } catch (error: any) {
    console.error('CUSTOMER PUT ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}