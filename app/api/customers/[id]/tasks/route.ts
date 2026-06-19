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

    const tasks = await prisma.task.findMany({
      where: { customerId },
    });
    return NextResponse.json(tasks);
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
    const { title, dueDate } = body;
    if (!title?.trim()) return NextResponse.json({ error: 'Nội dung công việc không được trống' }, { status: 400 });

    const finalDueDate = dueDate?.trim() || new Date().toISOString().split('T')[0];

    const newTask = await prisma.task.create({
      data: { customerId, title: title.trim(), dueDate: finalDueDate, isCompleted: false },
    });
    return NextResponse.json(newTask);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { taskId, isCompleted, title, dueDate } = body;
    if (!taskId) return NextResponse.json({ error: 'Thiếu ID nhiệm vụ' }, { status: 400 });

    const updateData: any = {};
    if (isCompleted !== undefined) updateData.isCompleted = Boolean(isCompleted);
    if (title !== undefined) updateData.title = title.trim();
    if (dueDate !== undefined) updateData.dueDate = dueDate;

    const updatedTask = await prisma.task.update({
      where: { id: parseInt(taskId, 10) },
      data: updateData,
    });
    return NextResponse.json(updatedTask);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}