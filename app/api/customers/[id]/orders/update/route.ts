export const dynamic = 'force-dynamic';

import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function POST(
  request: Request,
  context: any
) {
  try {
    const params = context.params;
    const customerId = parseInt(params.id, 10);

    if (isNaN(customerId)) {
      return NextResponse.json({ success: false, error: "ID khách hàng không hợp lệ" }, { status: 400 });
    }

    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ success: false, error: "Dữ liệu không hợp lệ" }, { status: 400 });
    }

    // 1. Lấy dữ liệu cũ bằng SQL thuần để đối chiếu làm nhật ký biến động
    let oldItems: any[] = [];
    try {
      oldItems = await prisma.$queryRawUnsafe(
        `SELECT * FROM customer_orders WHERE customer_id = $1`, 
        customerId
      );
    } catch (e) {
      oldItems = [];
    }

    let logs: string[] = [];

    // 2. XÓA CẤU PHẦN CŨ BẰNG SQL THUẦN
    await prisma.$executeRawUnsafe(
      `DELETE FROM customer_orders WHERE customer_id = $1`, 
      customerId
    );

    let currentTotalValue = 0;

    // 3. GHI ĐÈ DANH SÁCH MỚI BẰNG SQL THUẦN
    for (const item of items) {
      if (!item.product_name || item.product_name.trim() === '') continue;

      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      const rowTotal = qty * price;
      currentTotalValue += rowTotal;

      // Bắn lệnh INSERT trực tiếp xuống bảng customer_orders dưới Supabase
      await prisma.$executeRawUnsafe(
        `INSERT INTO customer_orders (customer_id, product_name, quantity, unit_price, total_price, updated_at) 
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        customerId,
        item.product_name.trim(),
        qty,
        price,
        rowTotal
      );

      // Logic so sánh tạo chuỗi log lịch sử
      const oldMatch = oldItems.find(
        (o: any) => o.product_name.trim().toLowerCase() === item.product_name.trim().toLowerCase()
      );
      if (oldMatch) {
        if (parseFloat(oldMatch.quantity) !== qty || parseFloat(oldMatch.unit_price) !== price) {
          logs.push(`Sửa [${item.product_name}]: từ (${oldMatch.quantity} tấn) thành (${qty} tấn)`);
        }
      } else {
        logs.push(`Thêm mới [${item.product_name}] sản lượng ${qty} tấn`);
      }
    }

    // Kiểm tra cấu phần đơn hàng bị xóa hẳn
    for (const old of oldItems) {
      const stillExists = items.some(
        (i: any) => i.product_name && i.product_name.trim().toLowerCase() === old.product_name.trim().toLowerCase()
      );
      if (!stillExists) {
        logs.push(`Xóa bỏ mặt hàng [${old.product_name}]`);
      }
    }

    // 4. GHI LOG LỊCH SỬ VÀO BẢNG order_history_logs BẰNG SQL THUẦN Cho Quản Lý Xem
    if (logs.length > 0) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO order_history_logs (customer_id, change_summary, updated_by, created_at) 
         VALUES ($1, $2, $3, NOW())`,
        customerId,
        logs.join(' | '),
        'Nhân viên kinh doanh'
      );
    }

    // 5. ĐỒNG BỘ GIÁ TRỊ VỀ BẢNG CUSTOMER GỐC
    // (Bảng Customer gốc dùng Prisma chuẩn vì đã chạy mượt từ trước)
    await prisma.customer.update({
      where: { id: customerId },
      data: { value: String(currentTotalValue) }
    });

    return NextResponse.json({ success: true, newValue: String(currentTotalValue) });
  } catch (error: any) {
    console.error("Lỗi crash hệ thống API:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}