'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      
      // Thử getSession trước
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        setChecking(false)
        return
      }

      // Nếu không có session, thử refreshSession
      const { data: { session: refreshed } } = await supabase.auth.refreshSession()
      
      if (refreshed) {
        setChecking(false)
      } else {
        window.location.href = '/login'
      }
    }
    checkAuth()
  }, [])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    )
  }

  return <>{children}</>
}