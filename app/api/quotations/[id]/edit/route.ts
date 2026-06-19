import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

// Thêm import này:
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request, context: any) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { items, valid_days, note, sales_support, delivery_person, delivery_status } = body;

    // Nếu chỉ cập nhật thông tin giao hàng (không có items)
    if (!items) {
      await prisma.$executeRawUnsafe(`
        UPDATE quotations
        SET sales_support = $1, delivery_person = $2, delivery_status = $3, updated_at = NOW()
        WHERE id = $4
      `, sales_support || '', delivery_person || '', delivery_status || 'pending', parseInt(id));

      // Tự động chuyển pipeline → delivering khi tất cả đơn hàng đã giao
      const quotation = await prisma.$queryRawUnsafe(`
        SELECT customer_id FROM quotations WHERE id = $1
      `, parseInt(id)) as any[];

      if (quotation.length > 0) {
        const customerId = quotation[0].customer_id;
        // Check tất cả quotations của KH (không phân biệt status)
        const allQuotations = await prisma.$queryRawUnsafe(`
          SELECT COUNT(*) as total,
                 SUM(CASE WHEN delivery_status = 'delivered' THEN 1 ELSE 0 END) as delivered
          FROM quotations
          WHERE customer_id = $1
        `, customerId) as any[];

        if (allQuotations.length > 0) {
          const data = allQuotations[0];
          const total = parseInt(data.total) || 0;
          const delivered = parseInt(data.delivered) || 0;

          // Nếu có ít nhất 1 quotation và tất cả đều delivered → chuyển pipeline
          if (total > 0 && total === delivered) {
            await prisma.$executeRawUnsafe(`
              UPDATE "Customer" SET pipeline = 'delivering' WHERE id = $1
            `, customerId);
          }
        }
      }

      return NextResponse.json({ success: true });
    }

    // Tính lại tổng
    const total_value = items.reduce((sum: number, item: any) =>
      sum + (parseFloat(item.quantity) * parseFloat(item.unit_price)), 0);

    // Cập nhật thông tin chính
    await prisma.$executeRawUnsafe(`
      UPDATE quotations
      SET valid_days = $1, note = $2, total_value = $3,
          sales_support = $4, delivery_person = $5, delivery_status = $6,
          updated_at = NOW()
      WHERE id = $7
    `, valid_days, note || '', total_value,
       sales_support || '', delivery_person || '', delivery_status || 'pending',
       parseInt(id));

    // Xóa items cũ và thêm lại
    await prisma.$executeRawUnsafe(
      `DELETE FROM quotation_items WHERE quotation_id = $1`, parseInt(id)
    );

    for (const item of items) {
      if (!item.product_name?.trim()) continue;
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      await prisma.$executeRawUnsafe(`
        INSERT INTO quotation_items (quotation_id, product_name, unit, quantity, unit_price, total_price, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, parseInt(id), item.product_name.trim(), item.unit || 'Tấn',
         qty, price, qty * price, item.note || '');
    }

    return NextResponse.json({ success: true, total_value });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}