import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/getUser';

// Thêm import này:
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';

const ALL_STATUSES = ['Tiếp cận', 'Đang đàm phán', 'Báo giá', 'Thành công', 'Tạm dừng', 'Thất bại'];

const PIPELINE_STAGES = [
  { key: 'approach', label: 'Tiếp cận' },
  { key: 'survey', label: 'Khảo sát' },
  { key: 'quoted', label: 'Báo giá' },
  { key: 'negotiating', label: 'Đàm phán' },
  { key: 'signed', label: 'Lên đơn' },
  { key: 'delivering', label: 'Giao hàng' },
  { key: 'collecting', label: 'Thu tiền' },
  { key: 'done', label: 'Hoàn thành' },
];

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const whereClause = user.role === 'admin' ? {} : { assigned_to: user.id }
    const customers = await prisma.customer.findMany({ where: whereClause }) as any[]

    const totalCustomers = customers.length
    const successCustomers = customers.filter(c =>
      c.status?.trim().toLowerCase() === 'thành công'
    ).length
    const successRate = totalCustomers > 0
      ? Math.round((successCustomers / totalCustomers) * 100)
      : 0

    const totalValue = customers.reduce((sum, c) => {
      const num = parseInt((c.value || '0').replace(/[^0-9]/g, ''), 10)
      return sum + (isNaN(num) ? 0 : num)
    }, 0)

    const statusBreakdown = ALL_STATUSES.map(status => ({
      name: status,
      value: customers.filter(c =>
        c.status?.trim().toLowerCase() === status.toLowerCase()
      ).length,
    }))

    const revenueByMonth: Record<string, number> = {}
    customers.forEach(c => {
      const month = new Date(c.createdAt).toLocaleDateString('vi-VN', {
        month: 'short', year: 'numeric'
      })
      const val = parseInt((c.value || '0').replace(/[^0-9]/g, ''), 10)
      revenueByMonth[month] = (revenueByMonth[month] || 0) + (isNaN(val) ? 0 : val)
    })

    const revenueChart = Object.entries(revenueByMonth).map(([month, value]) => ({
      month, value
    }))

    const pipelineBreakdown = PIPELINE_STAGES.map(stage => ({
      key: stage.key,
      label: stage.label,
      value: customers.filter(c => c.pipeline === stage.key).length,
    }))

    return NextResponse.json({
      totalCustomers, successCustomers, successRate,
      totalValue, statusBreakdown, revenueChart, pipelineBreakdown,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
