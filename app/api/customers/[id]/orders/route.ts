export const dynamic = 'force-dynamic';

import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

// Thêm import này:
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, context: any) {
  try {
    const params = await context.params;
    const customerId = parseInt(params.id, 10);

    const items = await prisma.$queryRawUnsafe(
      `SELECT id, product_name, quantity, unit_price, total_price FROM customer_orders WHERE customer_id = $1 ORDER BY id ASC`,
      customerId
    );
    return NextResponse.json(items);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request, context: any) {
  try {
    const params = await context.params;
    const customerId = parseInt(params.id, 10);
    if (isNaN(customerId)) return NextResponse.json({ success: false, error: 'ID không hợp lệ' }, { status: 400 });

    const body = await request.json();
    const { items } = body;
    if (!items || !Array.isArray(items)) return NextResponse.json({ success: false, error: 'Dữ liệu không đúng cấu trúc' }, { status: 400 });

    let oldItems: any[] = [];
    try {
      oldItems = await prisma.$queryRawUnsafe(`SELECT * FROM customer_orders WHERE customer_id = $1`, customerId);
    } catch (e) { oldItems = []; }

    let logs: string[] = [];

    await prisma.$executeRawUnsafe(`DELETE FROM customer_orders WHERE customer_id = $1`, customerId);

    let currentTotalValue = 0;

    for (const item of items) {
      if (!item.product_name || item.product_name.trim() === '') continue;
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      const rowTotal = qty * price;
      currentTotalValue += rowTotal;

      await prisma.$executeRawUnsafe(
        `INSERT INTO customer_orders (customer_id, product_name, quantity, unit_price, total_price, updated_at) VALUES ($1, $2, $3, $4, $5, NOW())`,
        customerId, item.product_name.trim(), qty, price, rowTotal
      );

      const oldMatch = oldItems.find((o: any) => o.product_name.trim().toLowerCase() === item.product_name.trim().toLowerCase());
      if (oldMatch) {
        if (parseFloat(oldMatch.quantity) !== qty || parseFloat(oldMatch.unit_price) !== price) {
          logs.push(`Sửa [${item.product_name}]: SL (${oldMatch.quantity} -> ${qty}), giá (${new Intl.NumberFormat('vi-VN').format(oldMatch.unit_price)}đ -> ${new Intl.NumberFormat('vi-VN').format(price)}đ)`);
        }
      } else {
        logs.push(`Thêm mới [${item.product_name}] SL ${qty} tấn`);
      }
    }

    for (const old of oldItems) {
      const stillExists = items.some((i: any) => i.product_name?.trim().toLowerCase() === old.product_name.trim().toLowerCase());
      if (!stillExists) logs.push(`Xóa [${old.product_name}]`);
    }

    if (logs.length > 0) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO order_history_logs (customer_id, change_summary, updated_by, created_at) VALUES ($1, $2, $3, NOW())`,
        customerId, logs.join(' | '), 'Nhân viên kinh doanh'
      );
    }

    await prisma.customer.update({
      where: { id: customerId },
      data: { value: String(currentTotalValue) }
    });

    return NextResponse.json({ success: true, newValue: String(currentTotalValue) });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}