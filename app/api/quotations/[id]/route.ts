import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';

// GET — Chi tiết báo giá + items
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
      return NextResponse.json({ error: 'Không tìm thấy báo giá' }, { status: 404 });
    }

    const items = await prisma.$queryRawUnsafe(`
      SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY id ASC
    `, parseInt(id));

    return NextResponse.json({ ...quotation[0], items });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT — Cập nhật trạng thái
export async function PUT(request: Request, context: any) {
  try {
    const { id } = await context.params;
    const { status } = await request.json();

    const sentAt = status === 'sent' ? ', sent_at = NOW()' : '';
    await prisma.$executeRawUnsafe(`
      UPDATE quotations SET status = $1, updated_at = NOW() ${sentAt} WHERE id = $2
    `, status, parseInt(id));

    // ── KHI BÁO GIÁ ĐƯỢC CHẤP NHẬN ──
    if (status === 'accepted') {
      const quotation = await prisma.$queryRawUnsafe(`
        SELECT q.*, c.name as customer_name
        FROM quotations q
        LEFT JOIN "Customer" c ON c.id = q.customer_id
        WHERE q.id = $1
      `, parseInt(id)) as any[];

      if (quotation.length > 0) {
        const q = quotation[0];

        // 1. Lấy items từ báo giá
        const quoteItems = await prisma.$queryRawUnsafe(`
          SELECT * FROM quotation_items WHERE quotation_id = $1
        `, parseInt(id)) as any[];

        if (quoteItems.length > 0) {
          let newOrderTotal = 0;

          // 2. THÊM MỚI vào customer_orders — KHÔNG xóa đơn cũ
          for (const item of quoteItems as any[]) {
            const qty = parseFloat(item.quantity);
            const price = parseFloat(item.unit_price);
            const rowTotal = qty * price;
            newOrderTotal += rowTotal;

            await prisma.$executeRawUnsafe(`
              INSERT INTO customer_orders (customer_id, product_name, quantity, unit_price, total_price, updated_at)
              VALUES ($1, $2, $3, $4, $5, NOW())
            `, q.customer_id, item.product_name, qty, price, rowTotal);
          }

          // 3. Tính lại tổng giá trị KH (cộng dồn tất cả đơn hàng)
          const totalResult = await prisma.$queryRawUnsafe(`
            SELECT COALESCE(SUM(total_price), 0) as total
            FROM customer_orders
            WHERE customer_id = $1
          `, q.customer_id) as any[];

          const totalValue = parseFloat(totalResult[0].total) || 0;

          // 4. Ghi log biến động
          await prisma.$executeRawUnsafe(`
            INSERT INTO order_history_logs (customer_id, change_summary, updated_by, created_at)
            VALUES ($1, $2, $3, NOW())
          `, q.customer_id,
             `Thêm đơn hàng từ báo giá ${q.quote_number} | ${(quoteItems as any[]).length} sản phẩm | Giá trị: ${new Intl.NumberFormat('vi-VN').format(newOrderTotal)}đ`,
             q.created_by || 'system'
          );

          // 5. Cập nhật tổng giá trị + trạng thái KH
          await prisma.customer.update({
            where: { id: q.customer_id },
            data: {
              value: String(totalValue),
              status: 'Thành công',
            }
          });
        }

        // 6. Tạo công nợ nếu chưa có
        const existing = await prisma.$queryRawUnsafe(`
          SELECT id FROM debts WHERE quotation_id = $1
        `, parseInt(id)) as any[];

        if (existing.length === 0) {
          await prisma.$executeRawUnsafe(`
            INSERT INTO debts (customer_id, quotation_id, title, total_amount, paid_amount, due_date, status, note, created_by)
            VALUES ($1, $2, $3, $4, 0, NOW() + INTERVAL '30 days', 'unpaid', $5, $6)
          `,
            q.customer_id,
            parseInt(id),
            `Đơn hàng ${q.quote_number} - ${q.customer_name}`,
            q.total_value,
            `Tạo tự động từ báo giá ${q.quote_number}`,
            q.created_by || 'system'
          );
        }

        // 7. Tự động chuyển pipeline → signed
        await prisma.$executeRawUnsafe(`
          UPDATE "Customer" SET pipeline = 'signed' WHERE id = $1
        `, q.customer_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Xóa báo giá
export async function DELETE(request: Request, context: any) {
  try {
    const { id } = await context.params;
    await prisma.$executeRawUnsafe(`DELETE FROM quotations WHERE id = $1`, parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}