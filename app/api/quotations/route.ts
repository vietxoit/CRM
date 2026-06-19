import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/getUser';

// Thêm import này:
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';

async function generateQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as cnt FROM quotations WHERE EXTRACT(YEAR FROM created_at) = $1`,
    year
  ) as any[];
  const num = (parseInt(count[0].cnt) + 1).toString().padStart(3, '0');
  return `BG-${year}-${num}`;
}

// GET — Danh sách báo giá
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    let whereClause = '';
    if (customerId) {
      whereClause = `WHERE q.customer_id = ${parseInt(customerId)}`;
    } else if (user.role !== 'admin') {
      whereClause = `WHERE q.created_by = '${user.email}'`;
    }

    const quotations = await prisma.$queryRawUnsafe(`
      SELECT q.*, c.name as customer_name, c.company,
       c.email as customer_email, c.phone
      FROM quotations q
      LEFT JOIN "Customer" c ON c.id = q.customer_id
      ${whereClause}
      ORDER BY q.created_at DESC
    `);

    return NextResponse.json(quotations);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Tạo báo giá mới
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { customer_id, items, valid_days, note } = body;

    if (!customer_id || !items?.length) {
      return NextResponse.json({ error: 'Thiếu thông tin báo giá' }, { status: 400 });
    }

    const quote_number = await generateQuoteNumber();
    const total_value = items.reduce((sum: number, item: any) =>
      sum + (parseFloat(item.quantity) * parseFloat(item.unit_price)), 0
    );

    const result = await prisma.$queryRawUnsafe(`
      INSERT INTO quotations (customer_id, quote_number, valid_days, note, total_value, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, parseInt(customer_id), quote_number, valid_days || 7,
       note || '', total_value, user.email) as any[];

    const quotationId = result[0].id;

    for (const item of items) {
      if (!item.product_name?.trim()) continue;
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      await prisma.$executeRawUnsafe(`
        INSERT INTO quotation_items (quotation_id, product_name, unit, quantity, unit_price, total_price, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, quotationId, item.product_name.trim(), item.unit || 'Tấn',
         qty, price, qty * price, item.note || '');
    }

    return NextResponse.json({ success: true, quotation: result[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}