'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      console.log('🔍 Attempting login for:', email)

      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      console.log('✅ Auth response:', { data, error })

      if (error) {
        console.error('❌ Auth error:', error.message)
        setError(`Lỗi đăng nhập: ${error.message}`)
        setLoading(false)
        return
      }

      if (!data.session) {
        console.error('❌ Không nhận được session')
        setError('Không thể tạo session. Kiểm tra console.')
        setLoading(false)
        return
      }

      console.log('✅ Login success! Session:', data.session.access_token.substring(0, 20) + '...')
      console.log('✅ localStorage sb-session:', localStorage.getItem('sb-session') ? 'Có' : 'Không')

      window.location.href = '/customers'
    } catch (err: any) {
      console.error('❌ Unexpected error:', err)
      setError(`Lỗi: ${err.message}`)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Việt Xô CRM</h1>
          <p className="text-sm text-slate-400 mt-1">Đăng nhập để tiếp tục</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="example@vietxo.com"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Mật khẩu</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700" />
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Đang đăng nhập...</> : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  )
}