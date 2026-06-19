export const dynamic = 'force-dynamic';

import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function GET(request: Request, context: { params: any }) {
  try {
    const resolvedParams = await context.params;
    const customerId = parseInt(resolvedParams.id, 10);

    const logs = await (prisma as any).order_history_logs.findMany({
      where: { customer_id: customerId },
      orderBy: { created_at: 'desc' }
    });

    return NextResponse.json(logs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}