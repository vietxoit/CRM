import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/getUser';
export const dynamic = 'force-dynamic';

// GET — Lấy danh sách báo giá accepted chưa có công nợ
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const quotes = await prisma.$queryRawUnsafe(`
      SELECT q.id, q.quote_number, q.total_value, q.created_at,
             c.name as customer_name, c.id as customer_id, c.company
      FROM quotations q
      LEFT JOIN "Customer" c ON c.id = q.customer_id
      WHERE q.status = 'accepted'
        AND q.id NOT IN (SELECT quotation_id FROM debts WHERE quotation_id IS NOT NULL)
      ORDER BY q.created_at DESC
    `);

    return NextResponse.json(quotes);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}