'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit() {
    setLoading(true)
    setMessage('')

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setMessage('❌ ' + error.message); setLoading(false); return }
      router.push('/dashboard')
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setMessage('❌ ' + error.message); setLoading(false); return }
      setMessage('✅ 註冊成功！請檢查信箱確認帳號')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0D0D12',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, PingFang TC, sans-serif'
    }}>
      <div style={{
        width: '100%', maxWidth: '400px',
        background: '#1E1E2E', borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.07)',
        padding: '40px 32px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '48px', height: '48px', margin: '0 auto 12px',
            background: 'linear-gradient(135deg, #7C6FFF, #A78BFA)',
            borderRadius: '14px', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', fontWeight: '800', color: '#fff'
          }}>P</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#F0EFFF' }}>
            Post<span style={{ color: '#A78BFA' }}>Pilot</span>
          </div>
          <div style={{ fontSize: '13px', color: '#9B9AB8', marginTop: '6px' }}>
            {isLogin ? '登入你的帳號' : '建立新帳號'}
          </div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '12px', color: '#9B9AB8', marginBottom: '6px', fontWeight: '600' }}>Email</div>
          <input
            type="email" value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            style={{
              width: '100%', background: '#13131A',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '8px', color: '#F0EFFF',
              fontSize: '14px', padding: '10px 13px',
              outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', color: '#9B9AB8', marginBottom: '6px', fontWeight: '600' }}>密碼</div>
          <input
            type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{
              width: '100%', background: '#13131A',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '8px', color: '#F0EFFF',
              fontSize: '14px', padding: '10px 13px',
              outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>

        {message && (
          <div style={{
            background: message.includes('✅') ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
            border: `1px solid ${message.includes('✅') ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
            borderRadius: '8px', padding: '10px 14px',
            fontSize: '13px', color: message.includes('✅') ? '#34D399' : '#F87171',
            marginBottom: '14px'
          }}>{message}</div>
        )}

        <button
          onClick={handleSubmit} disabled={loading}
          style={{
            width: '100%', padding: '13px',
            background: 'linear-gradient(135deg, #7C6FFF, #A78BFA)',
            color: '#fff', border: 'none', borderRadius: '8px',
            fontSize: '15px', fontWeight: '700', cursor: 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? '處理中...' : isLogin ? '登入' : '註冊'}
        </button>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#9B9AB8' }}>
          {isLogin ? '還沒有帳號？' : '已有帳號？'}
          <span
            onClick={() => { setIsLogin(!isLogin); setMessage('') }}
            style={{ color: '#A78BFA', cursor: 'pointer', marginLeft: '4px', fontWeight: '600' }}
          >
            {isLogin ? '立即註冊' : '返回登入'}
          </span>
        </div>

        <div style={{ textAlign: 'center', marginTop: '18px', fontSize: '12px', color: '#5C5B78' }}>
          <a href="/privacy" style={{ color: '#5C5B78', textDecoration: 'none' }}>隱私政策</a>
          <span style={{ margin: '0 8px' }}>·</span>
          <a href="/terms" style={{ color: '#5C5B78', textDecoration: 'none' }}>服務條款</a>
        </div>
      </div>
    </div>
  )
}