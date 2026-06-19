import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'

// Thêm import này:
import { prisma } from '@/lib/prisma';

export async function getCurrentUser(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.replace('Bearer ', '')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null

  const profile = await prisma.$queryRawUnsafe(
    `SELECT role, full_name FROM staff_profiles WHERE id = $1::uuid`,
    user.id
  ) as any[]

  const role = profile?.[0]?.role ?? 'staff'
  const full_name = profile?.[0]?.full_name ?? user.email

  console.log('USER:', user.email, '| ROLE:', role)

  return { id: user.id, email: user.email, role, full_name }
}