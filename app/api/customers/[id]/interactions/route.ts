export const dynamic = 'force-dynamic';

import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

// Thêm import này:
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await context.params;
    const customerId = parseInt(resolvedParams.id, 10);
    if (isNaN(customerId)) return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });

    const logs = await prisma.interaction.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(logs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await context.params;
    const customerId = parseInt(resolvedParams.id, 10);
    if (isNaN(customerId)) return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });

    const body = await request.json();
    const { content, noteType } = body;
    if (!content?.trim()) return NextResponse.json({ error: 'Nội dung không được trống' }, { status: 400 });

    const newLog = await prisma.interaction.create({
      data: { customerId, content: content.trim(), noteType: noteType || 'Gọi điện' },
    });
    return NextResponse.json(newLog);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}