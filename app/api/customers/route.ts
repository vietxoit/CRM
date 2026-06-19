import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/getUser';

// Thêm import này:
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request)
    console.log('API GET user:', user)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const customers = await prisma.customer.findMany({
      where: user.role === 'admin' ? {} : { assigned_to: user.id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(customers)
  } catch (error: any) {
    console.log('API GET ERROR:', error.message, error.stack)
    return NextResponse.json({
      error: 'Lỗi kết nối database',
      details: error.message || String(error)
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request)
    console.log('API POST user:', user)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { name, company, phone, email, value, status } = body

    if (!name) {
      return NextResponse.json({ error: 'Tên khách hàng là bắt buộc' }, { status: 400 })
    }

    const newCustomer = await prisma.customer.create({
      data: {
        name,
        company:     company || 'Chưa cập nhật',
        phone:       phone   || 'Chưa cập nhật',
        email:       email   || 'Chưa cập nhật',
        value:       value   || '0 đ',
        status:      status  || 'Tiếp cận',
        assigned_to: user.id,
      },
    })
    return NextResponse.json(newCustomer)
  } catch (error: any) {
    console.log('API POST ERROR:', error.message, error.stack)
    return NextResponse.json({
      error: 'Lỗi ghi dữ liệu',
      details: error.message || String(error)
    }, { status: 500 })
  }
}