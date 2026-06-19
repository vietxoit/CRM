import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';

// GET — Chi tiết công nợ + lịch sử thanh toán
export async function GET(request: Request, context: any) {
  try {
    const { id } = await context.params;

    const debt = await prisma.$queryRawUnsafe(`
      SELECT d.*, c.name as customer_name, c.company, c.phone,
             (d.total_amount - d.paid_amount) as remaining_amount
      FROM debts d
      LEFT JOIN "Customer" c ON c.id = d.customer_id
      WHERE d.id = $1
    `, parseInt(id)) as any[];

    if (!debt.length) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 });

    const payments = await prisma.$queryRawUnsafe(`
      SELECT * FROM debt_payments WHERE debt_id = $1 ORDER BY paid_at DESC
    `, parseInt(id));

    return NextResponse.json({ ...debt[0], payments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Thêm đợt thanh toán mới
export async function POST(request: Request, context: any) {
  try {
    const { id } = await context.params;
    const { amount, paid_at, note, auto_offset = true } = await request.json();

    if (!amount || !paid_at) {
      return NextResponse.json({ error: 'Thiếu số tiền hoặc ngày thanh toán' }, { status: 400 });
    }

    const debtId = parseInt(id);
    const paidAmount = parseFloat(amount);

    // Lấy info debt hiện tại
    const currentDebt = await prisma.$queryRawUnsafe(`
      SELECT customer_id, total_amount, paid_amount FROM debts WHERE id = $1
    `, debtId) as any[];

    if (!currentDebt.length) {
      return NextResponse.json({ error: 'Không tìm thấy công nợ' }, { status: 404 });
    }

    const customerId = currentDebt[0].customer_id;
    let remainingAmount = paidAmount;

    // 1. Ghi nhận thanh toán cho debt này
    await prisma.$executeRawUnsafe(`
      INSERT INTO debt_payments (debt_id, amount, paid_at, note)
      VALUES ($1, $2, $3::date, $4)
    `, debtId, paidAmount, paid_at, note || '');

    await prisma.$executeRawUnsafe(`
      UPDATE debts SET paid_amount = paid_amount + $1, updated_at = NOW()
      WHERE id = $2
    `, paidAmount, debtId);

    // 2. Nếu auto_offset = true, tự động khấu trừ phần thừa cho debts khác
    if (auto_offset) {
      const allDebts = await prisma.$queryRawUnsafe(`
        SELECT id, total_amount, paid_amount FROM debts
        WHERE customer_id = $1 AND status != 'paid'
        ORDER BY due_date ASC
      `, customerId) as any[];

      for (const debt of allDebts) {
        if (debt.id === debtId) continue; // bỏ qua debt hiện tại

        const needToPay = Math.max(0, debt.total_amount - debt.paid_amount);
        const canApply = Math.min(remainingAmount, needToPay);

        if (canApply > 0) {
          await prisma.$executeRawUnsafe(`
            UPDATE debts SET paid_amount = paid_amount + $1, updated_at = NOW()
            WHERE id = $2
          `, canApply, debt.id);

          // Ghi log bút toán tự động
          await prisma.$executeRawUnsafe(`
            INSERT INTO debt_payments (debt_id, amount, paid_at, note)
            VALUES ($1, $2, $3::date, $4)
          `, debt.id, canApply, paid_at, `[AUTO] Khấu trừ từ đơn hàng khác`);

          remainingAmount -= canApply;

          if (remainingAmount <= 0) break;
        }
      }
    }

    // Cập nhật status tất cả debts của KH (vì có khấu trừ tự động)
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

    // Tự động chuyển pipeline → done khi tất cả công nợ của KH đã thanh toán đủ
    const unpaidDebts = await prisma.$queryRawUnsafe(`
      SELECT id FROM debts WHERE customer_id = $1 AND status != 'paid'
    `, customerId) as any[];

    if (unpaidDebts.length === 0) {
      await prisma.$executeRawUnsafe(`
        UPDATE "Customer" SET pipeline = 'done' WHERE id = $1
      `, customerId);

      // Cập nhật tất cả đơn hàng của KH sang đã giao
      await prisma.$executeRawUnsafe(`
        UPDATE quotations SET delivery_status = 'delivered', updated_at = NOW()
        WHERE customer_id = $1 AND delivery_status != 'delivered'
      `, customerId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT — Cập nhật hạn thanh toán
export async function PUT(request: Request, context: any) {
  try {
    const { id } = await context.params;
    const { due_date } = await request.json();

    if (!due_date) {
      return NextResponse.json({ error: 'Thiếu hạn thanh toán' }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(`
      UPDATE debts SET due_date = $1::date, updated_at = NOW()
      WHERE id = $2
    `, due_date, parseInt(id));

    // Cập nhật lại trạng thái sau khi đổi hạn
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
      WHERE id = $1
    `, parseInt(id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Xóa công nợ
export async function DELETE(request: Request, context: any) {
  try {
    const { id } = await context.params;
    await prisma.$executeRawUnsafe(`DELETE FROM debts WHERE id = $1`, parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}