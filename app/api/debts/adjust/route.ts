import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';

// POST — Điều chỉnh bút toán giữa 2 công nợ
export async function POST(request: Request) {
  try {
    const { from_debt_id, to_debt_id, amount, note } = await request.json();

    if (!from_debt_id || !to_debt_id || !amount) {
      return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
    }

    const fromDebtId = parseInt(from_debt_id);
    const toDebtId = parseInt(to_debt_id);
    const adjustAmount = parseFloat(amount);

    if (adjustAmount <= 0) {
      return NextResponse.json({ error: 'Số tiền phải lớn hơn 0' }, { status: 400 });
    }

    // Kiểm tra cả 2 debt tồn tại và thuộc cùng 1 KH
    const fromDebt = await prisma.$queryRawUnsafe(`
      SELECT id, customer_id, paid_amount, total_amount FROM debts WHERE id = $1
    `, fromDebtId) as any[];

    const toDebt = await prisma.$queryRawUnsafe(`
      SELECT id, customer_id, paid_amount, total_amount FROM debts WHERE id = $1
    `, toDebtId) as any[];

    if (!fromDebt.length || !toDebt.length) {
      return NextResponse.json({ error: 'Không tìm thấy công nợ' }, { status: 404 });
    }

    if (fromDebt[0].customer_id !== toDebt[0].customer_id) {
      return NextResponse.json({ error: 'Hai công nợ phải thuộc cùng 1 khách hàng' }, { status: 400 });
    }

    const customerId = fromDebt[0].customer_id;

    // Kiểm tra debt từ có đủ để khấu trừ không (có thể âm = thừa)
    const fromRemaining = fromDebt[0].total_amount - fromDebt[0].paid_amount;
    if (fromRemaining > adjustAmount) {
      return NextResponse.json({
        error: `Công nợ này chưa thanh toán ${adjustAmount}, không thể khấu trừ. Còn lại: ${fromRemaining}`
      }, { status: 400 });
    }

    // Thực hiện điều chỉnh
    // 1. Giảm paid_amount debt từ
    await prisma.$executeRawUnsafe(`
      UPDATE debts SET paid_amount = paid_amount - $1, updated_at = NOW()
      WHERE id = $2
    `, adjustAmount, fromDebtId);

    // 2. Tăng paid_amount debt đến
    await prisma.$executeRawUnsafe(`
      UPDATE debts SET paid_amount = paid_amount + $1, updated_at = NOW()
      WHERE id = $2
    `, adjustAmount, toDebtId);

    // 3. Ghi log bút toán
    const today = new Date().toISOString().split('T')[0];
    await prisma.$executeRawUnsafe(`
      INSERT INTO debt_payments (debt_id, amount, paid_at, note)
      VALUES ($1, $2, $3::date, $4)
    `, fromDebtId, -adjustAmount, today, `[ADJUST] Khấu trừ sang công nợ khác`);

    await prisma.$executeRawUnsafe(`
      INSERT INTO debt_payments (debt_id, amount, paid_at, note)
      VALUES ($1, $2, $3::date, $4)
    `, toDebtId, adjustAmount, today, `[ADJUST] Nhận từ công nợ khác: ${note || ''}`);

    // 4. Cập nhật status tất cả debts
    await prisma.$executeRawUnsafe(`
      UPDATE debts SET status =
        CASE
          WHEN paid_amount >= total_amount THEN 'paid'
          WHEN paid_amount > 0 AND due_date < CURRENT_DATE THEN 'overdue'
          WHEN paid_amount > 0 THEN 'partial'
          WHEN due_date < CURRENT_DATE THEN 'overdue'
          ELSE 'unpaid'
        END,
        updated_at = NOW()
      WHERE customer_id = $1
    `, customerId);

    // 5. Kiểm tra xem tất cả debts đã paid không
    const unpaidDebts = await prisma.$queryRawUnsafe(`
      SELECT id FROM debts WHERE customer_id = $1 AND status != 'paid'
    `, customerId) as any[];

    if (unpaidDebts.length === 0) {
      await prisma.$executeRawUnsafe(`
        UPDATE "Customer" SET pipeline = 'done' WHERE id = $1
      `, customerId);
    }

    return NextResponse.json({ success: true, message: `Đã điều chỉnh ${adjustAmount}đ từ công nợ ${fromDebtId} sang ${toDebtId}` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
