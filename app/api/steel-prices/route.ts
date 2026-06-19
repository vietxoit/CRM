import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

// Thêm import này:
import { prisma } from '@/lib/prisma';

// GET — Lấy danh sách giá thép
export async function GET() {
  try {
    const prices = await prisma.$queryRawUnsafe(`
      SELECT * FROM steel_prices ORDER BY product_name ASC
    `);
    return NextResponse.json(prices);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Thêm sản phẩm mới vào bảng giá
export async function POST(request: Request) {
  try {
    const { product_name, unit, price, note } = await request.json();
    if (!product_name || !price) {
      return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 });
    }
    await prisma.$executeRawUnsafe(`
      INSERT INTO steel_prices (product_name, unit, price, note)
      VALUES ($1, $2, $3, $4)
    `, product_name, unit || 'Tấn', parseFloat(price), note || '');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT — Cập nhật giá
export async function PUT(request: Request) {
  try {
    const { id, price, note } = await request.json();
    await prisma.$executeRawUnsafe(`
      UPDATE steel_prices SET price = $1, note = $2, updated_at = NOW() WHERE id = $3
    `, parseFloat(price), note || '', parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Xóa sản phẩm khỏi bảng giá
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    await prisma.$executeRawUnsafe(`DELETE FROM steel_prices WHERE id = $1`, parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}