import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/getUser';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';

// GET — Danh sách công nợ
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    let whereClause = '';
    if (customerId) {
      whereClause = `WHERE d.customer_id = ${parseInt(customerId)}`;
    } else if (user.role !== 'admin') {
      whereClause = `WHERE d.created_by = '${user.email}'`;
    }

    // Tự động cập nhật trạng thái overdue
    await prisma.$executeRawUnsafe(`
      UPDATE debts SET status = 'overdue'
      WHERE status = 'unpaid' AND due_date < CURRENT_DATE
    `);

    const debts = await prisma.$queryRawUnsafe(`
      SELECT d.*,
             c.name as customer_name, c.company,
             (d.total_amount - d.paid_amount) as remaining_amount,
             COALESCE(q.quote_number, '') as quote_number
      FROM debts d
      LEFT JOIN "Customer" c ON c.id = d.customer_id
      LEFT JOIN quotations q ON q.id = d.quotation_id
      ${whereClause}
      ORDER BY
        CASE d.status
          WHEN 'overdue'  THEN 1
          WHEN 'unpaid'   THEN 2
          WHEN 'partial'  THEN 3
          WHEN 'paid'     THEN 4
        END,
        d.due_date ASC
    `);

    return NextResponse.json(debts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Tạo công nợ mới
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { customer_id, quotation_id, title, total_amount, paid_amount, due_date, note } = await request.json();

    if (!customer_id || !title || !total_amount || !due_date) {
      return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
    }

    const paid = parseFloat(paid_amount) || 0;
    const total = parseFloat(total_amount);
    const status = paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid';

    const result = await prisma.$queryRawUnsafe(`
      INSERT INTO debts (customer_id, quotation_id, title, total_amount, paid_amount, due_date, status, note, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, parseInt(customer_id),
       quotation_id ? parseInt(quotation_id) : null,
       title, total, paid, due_date, status, note || '', user.email) as any[];

    return NextResponse.json({ success: true, debt: result[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}