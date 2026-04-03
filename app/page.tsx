'use client'
import { supabase } from './lib/supabase'
import { useState, useEffect } from 'react'
function getMetricsFromLeads(leads: any[]) {
  const totalLeads = leads.length
  const bookedLeads = leads.filter(l => l.status === 'booked').length

  const conversion =
    totalLeads > 0
      ? Math.round((bookedLeads / totalLeads) * 100)
      : 0

  return {
    conversations: totalLeads,
    leads: totalLeads,
    booked: bookedLeads,
    conversion,
  }
}
// ─── Types ────────────────────────────────────────────────────────────────────

type Page = 'login' | 'signup' | 'owner-dash' | 'agency-dash'
type OwnerTab = 'overview' | 'conversations' | 'leads' | 'bookings' | 'analytics' | 'chatbot' | 'settings'
type AgencyTab = 'overview' | 'clients' | 'client-detail' | 'revenue' | 'whitelabel' | 'settings'

interface Account {
  id?: string
  pass: string
  role: 'owner' | 'agency'
  clinic?: string
  doctor?: string
  av?: string
}

interface ClientDetail {
  name: string
  email: string
  leads: number
  appts: number
  clinicId: string
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const ACCOUNTS: Record<string, Account> = {
  'owner@brightsmile.com':    { pass: 'demo123',    role: 'owner',  clinic: 'Bright Smile Dental',     doctor: 'Dr. Patel',    av: 'SP' },
  'owner@oakview.com':        { pass: 'demo123',    role: 'owner',  clinic: 'Oakview Family Dentistry', doctor: 'Dr. Thompson', av: 'OV' },
  'owner@metroortho.com':     { pass: 'demo123',    role: 'owner',  clinic: 'Metro Orthodontics',       doctor: 'Dr. Hassan',   av: 'MO' },
  'owner@westsidedental.com': { pass: 'demo123',    role: 'owner',  clinic: 'Westside Dental Care',     doctor: 'Dr. Clarke',   av: 'WD' },
  'admin@dentaflow.io':       { pass: 'agency2024', role: 'agency' },
}

// ─── Global styles injected once ─────────────────────────────────────────────

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; }
  body { font-family: 'Geist', system-ui, sans-serif; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 99px; }
  .sidebar-item { transition: all 0.15s ease; }
  .sidebar-item:hover { background: rgba(255,255,255,0.05); }
  .sidebar-item-active { background: rgba(59,130,246,0.15) !important; color: #60a5fa !important; }
  .client-row:hover { background: #f8fafc; }
  input:focus, textarea:focus { outline: none; box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
  .metric-card { transition: transform 0.2s ease, box-shadow 0.2s ease; box-shadow: inset 0 1px 0 rgba(255,255,255,0.07); }
  .metric-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.11); }
  .btn-primary-hover:hover { background: #1d4ed8 !important; transform: translateY(-0.5px); }
  .btn-primary-hover:active { transform: translateY(0); }
  .message-bubble { animation: slideUp 0.2s ease-out; }
  @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes pulseSoft { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
  @keyframes typingBounce { 0%,60%,100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-4px); opacity: 1; } }
  .animate-fade-in { animation: fadeIn 0.3s ease-out; }
  .animate-pulse-soft { animation: pulseSoft 2s ease-in-out infinite; }
  .typing-dot { animation: typingBounce 1.2s ease-in-out infinite; }
  .typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .typing-dot:nth-child(3) { animation-delay: 0.4s; }
`

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const ToothIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2z"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
)

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
    <path d="M20 6L9 17l-5-5"/>
  </svg>
)

const LogoutIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)

const SendIcon = () => (
  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)

const BackIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)

// ─── Star Rating ──────────────────────────────────────────────────────────────

const StarRating = () => (
  <div className="flex gap-0.5">
    {[...Array(5)].map((_, i) => (
      <svg key={i} className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
      </svg>
    ))}
  </div>
)

// ─── Login Page ───────────────────────────────────────────────────────────────

function LoginPage({
  onLogin,
  onGoSignup,
}: {
  onLogin: (email: string, password: string) => void
  onGoSignup: () => void
}) {
  const [email, setEmail] = useState('owner@brightsmile.com')
  const [password, setPassword] = useState('demo123')
  const [error, setError] = useState('')

  const doLogin = async () => {
  setError('')

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })

  if (error) {
    setError(error.message)
    return
  }

  onLogin(email.trim().toLowerCase(), password)
}

  const quickFill = (e: string, p: string) => {
    setEmail(e)
    setPassword(p)
    setError('')
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-950 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-gray-950 to-gray-950" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600 opacity-5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500 opacity-5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <ToothIcon className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">DentaFlow</span>
        </div>
        <div className="relative z-10 space-y-8">
          <div>
            <div className="text-blue-400 text-sm font-medium mb-3 tracking-wide uppercase">What&apos;s included</div>
            <div className="space-y-4">
              {[
                ['AI chatbot for your dental website', 'Handles bookings, FAQs and lead capture 24/7'],
                ['Real-time lead & analytics dashboard', 'See every conversation and conversion live'],
                ['Full white-label branding', 'Your logo, colours and domain'],
              ].map(([title, desc]) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckIcon className="w-2.5 h-2.5 text-white" />
                  </div>
                  <div>
                    <div className="text-white text-sm font-medium">{title}</div>
                    <div className="text-gray-500 text-xs mt-0.5">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">SP</div>
              <div>
                <div className="text-white text-sm font-medium">Dr. Sarah Patel</div>
                <div className="text-gray-500 text-xs">Bright Smile Dental, London</div>
              </div>
              <div className="ml-auto"><StarRating /></div>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed">
              &quot;DentaFlow transformed how we handle enquiries. 61 leads captured last month alone — we&apos;ve never had this kind of visibility before.&quot;
            </p>
          </div>
        </div>
        <div className="relative z-10 text-gray-600 text-xs">© 2026 DentaFlow. All rights reserved.</div>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <ToothIcon className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-base">DentaFlow</span>
          </div>
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-gray-900 mb-1.5">Welcome back</h1>
            <p className="text-gray-500 text-sm">Sign in to your practice portal</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doLogin()}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-gray-700">Password</label>
                <button className="text-xs text-blue-600 hover:text-blue-700">Forgot password?</button>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doLogin()}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400"
              />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              onClick={doLogin}
              className="btn-primary-hover w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg mt-2"
            >
              Sign in
            </button>
          </div>

          <div className="mt-6">
            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400">or continue with</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <button className="mt-4 w-full py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 font-medium flex items-center justify-center gap-2.5 hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </button>
          </div>

          {/* Demo accounts */}
          <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">Demo accounts</div>
            <div className="space-y-2">
              {[
                { email: 'owner@brightsmile.com', pass: 'demo123', label: 'Dr. Patel — Bright Smile', tag: 'Owner', tagClass: 'bg-blue-50 text-blue-600', av: 'SP', avClass: 'bg-blue-100 text-blue-700' },
                { email: 'admin@dentaflow.io', pass: 'agency2024', label: 'Agency Admin', tag: 'Agency', tagClass: 'bg-amber-50 text-amber-600', av: 'DF', avClass: 'bg-amber-100 text-amber-700' },
                { email: 'owner@oakview.com', pass: 'demo123', label: 'Dr. Thompson — Oakview', tag: 'Owner', tagClass: 'bg-blue-50 text-blue-600', av: 'OV', avClass: 'bg-emerald-100 text-emerald-700' },
              ].map(({ email: e, pass: p, label, tag, tagClass, av, avClass }) => (
                <button
                  key={e}
                  onClick={() => quickFill(e, p)}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-all text-left"
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${avClass}`}>{av}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-800">{label}</div>
                    <div className="text-xs text-gray-400 truncate">{e}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${tagClass}`}>{tag}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
  Access is by invitation only.
</p>
        </div>
      </div>
    </div>
  )
}

// ─── Signup Page ──────────────────────────────────────────────────────────────

function SignupPage({ onGoLogin }: { onGoLogin: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-8">
      <div className="w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <ToothIcon className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-base">DentaFlow</span>
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Invitation only
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Account creation is managed by your account manager.
        </p>

        <button
          onClick={onGoLogin}
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          Back to sign in
        </button>
      </div>
    </div>
  )
}

// ─── Owner Dashboard ──────────────────────────────────────────────────────────

function OwnerDashboard({
  account,
  email,
  onLogout,
  leads,
  metrics,
  onRefreshLeads,
}: {
  account: Account
  email: string
  onLogout: () => void
  leads: any[]
  metrics: {
  conversations: number
  leads: number
  booked: number
  conversion: number
  }
  onRefreshLeads: (clinicId: string) => Promise<void>
}) {
  const [activeTab, setActiveTab] = useState<OwnerTab>('overview')
  const [selectedConv, setSelectedConv] = useState<{ name: string; topic: string; av: string } | null>(null)

  const ownerTabs: { id: OwnerTab; label: string; icon: React.ReactNode; badge?: string; dot?: boolean }[] = [
    { id: 'overview', label: 'Overview', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
    { id: 'conversations', label: 'Conversations', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
    { id: 'leads', label: 'Leads', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> },
    { id: 'bookings', label: 'Bookings', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
    { id: 'analytics', label: 'Analytics', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
    { id: 'chatbot', label: 'Chatbot', icon: <ToothIcon className="w-3.5 h-3.5" />},
    { id: 'settings', label: 'Settings', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06-.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
  ]

  const clinicShort = account.clinic?.split(' ').slice(0, 2).join(' ') ?? ''

  return (
    <div className="min-h-screen bg-[#111111] text-white flex" style={{ height: '100vh' }}>
      {/* Sidebar */}
      <aside className="w-56 bg-[#151515] border-r border-white/10 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <ToothIcon className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">{clinicShort}</div>
              <div className="text-xs text-gray-500">Practice portal</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {ownerTabs.slice(0, 5).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`sidebar-item w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-medium ${activeTab === tab.id ? 'sidebar-item-active' : 'text-gray-400'}`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge && <span className="ml-auto bg-blue-900 text-blue-300 text-xs px-1.5 py-0.5 rounded-full font-medium">{tab.badge}</span>}
            </button>
          ))}
          <div className="my-2 h-px bg-white/10" />
          {ownerTabs.slice(5).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`sidebar-item w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-medium ${activeTab === tab.id ? 'sidebar-item-active' : 'text-gray-400'}`}
            >
              {tab.icon}
              {tab.label}
              {tab.dot && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
            <div className="w-7 h-7 rounded-full bg-blue-900 flex items-center justify-center text-blue-300 text-xs font-semibold flex-shrink-0">{account.av}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white truncate">{account.doctor}</div>
              <div className="text-xs text-gray-500 truncate">{email}</div>
            </div>
            <button onClick={onLogout} className="text-gray-500 hover:text-gray-300"><LogoutIcon /></button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-[#111111]">
        {activeTab === 'overview' && <OwnerOverview account={account} leads={leads} metrics={metrics} onViewLeads={() => setActiveTab('leads')} onViewBookings={() => setActiveTab('bookings')} onViewChatbot={() => setActiveTab('chatbot')} />}
        {activeTab === 'conversations' && <OwnerConversations selected={selectedConv} onSelect={setSelectedConv} />}

        {activeTab === 'leads' && <OwnerLeads leads={leads} clinicId={account.id ?? ''} onLeadAdded={() => onRefreshLeads(account.id ?? '')} />}
        {activeTab === 'bookings' && <PlaceholderTab label="Bookings view" />}
        {activeTab === 'analytics' && <PlaceholderTab label="Analytics view" />}
        {activeTab === 'chatbot' && <ChatbotIntegration clinicId={account.id ?? ''} />}
        {activeTab === 'settings' && <PlaceholderTab label="Settings" />}
      </main>
    </div>
  )
}

// ─── Owner: Overview ──────────────────────────────────────────────────────────

function OwnerOverview({ account, leads, metrics, onViewLeads, onViewBookings, onViewChatbot }: {
  account: Account
  leads: any[]
  metrics: {
  conversations: number
  leads: number
  booked: number
  conversion: number
}
  onViewLeads: () => void
  onViewBookings: () => void
  onViewChatbot: () => void
}) {
  const metricCards = [
  {
    label: 'Conversations',
    value: String(metrics.conversations || 0),
    delta: '',
    up: true,
    iconBg: '',
    iconColor: '',
    icon: null,
  },
  {
    label: 'Leads',
    value: String(metrics.leads || 0),
    delta: '',
    up: true,
    iconBg: '',
    iconColor: '',
    icon: null,
  },
  {
    label: 'Booked',
    value: String(metrics.booked || 0),
    delta: '',
    up: true,
    iconBg: '',
    iconColor: '',
    icon: null,
  },
  {
    label: 'Conversion',
    value: `${metrics.conversion || 0}%`,
    delta: '',
    up: true,
    iconBg: '',
    iconColor: '',
    icon: null,
  },
]
  
  return (
    <div className="p-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white tracking-tight">Good morning, {account.doctor}</h1>
        <p className="text-xs text-gray-600 mt-1">Here&apos;s what&apos;s happening at {account.clinic} today</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {metricCards.map((m) => (
          <div key={m.label} className="metric-card bg-gradient-to-b from-[#212121] to-[#191919] border border-white/[0.08] rounded-2xl p-5">
            <div className="mb-4">
              <span className="text-[11px] font-medium text-gray-600 uppercase tracking-widest">{m.label}</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1 tracking-tight">{m.value}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#1a1a1a] border border-white/[0.08] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Recent leads</h3>
            <button onClick={onViewLeads} className="text-xs text-gray-500 hover:text-gray-300 font-medium transition-colors">View all</button>
          </div>
          <div className="space-y-1">
  {leads.length === 0 ? (
    <div className="text-sm text-gray-500 py-4 text-center">No leads yet</div>
  ) : (
  leads.slice(0, 4).map((lead) => (
    <div key={lead.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-200">{lead.name}</div>
        <div className="text-xs text-gray-600 mt-0.5">{lead.service || 'General enquiry'}</div>
      </div>
      <span className="text-xs px-2.5 py-1 rounded-full bg-white/[0.07] text-gray-400 capitalize font-medium">
        {lead.status || 'new'}
      </span>
    </div>
  ))
)}
</div>
        </div>
      </div>
    </div>
  )
}

// ─── Owner: Conversations ─────────────────────────────────────────────────────

function OwnerConversations({ selected, onSelect }: {
  selected: { name: string; topic: string; av: string } | null
  onSelect: (c: { name: string; topic: string; av: string } | null) => void
}) {
  return (
    <div className="flex h-full" style={{ height: 'calc(100vh - 0px)' }}>
      <div className="w-72 border-r border-white/10 flex flex-col bg-[#151515]">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white mb-3">Conversations</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-1.5 px-6 text-center">
          <p className="text-xs font-medium text-gray-400">No conversations yet</p>
          <p className="text-xs text-gray-600 leading-relaxed">When new patient enquiries come in, they'll appear here.</p>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-1.5 bg-[#111111] text-center px-8">
        <p className="text-xs font-medium text-gray-400">No conversation selected</p>
        <p className="text-xs text-gray-600 leading-relaxed">Select a conversation to view messages here.</p>
      </div>
    </div>
  )
}

// ─── Add Lead Modal ───────────────────────────────────────────────────────────

function AddLeadModal({ clinicId, onClose, onSuccess }: {
  clinicId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [service, setService] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    setSubmitting(true)
    setError('')
    const { error: insertError } = await supabase.from('leads').insert({
      name: name.trim(),
      service: service.trim() || null,
      phone: phone.trim() || null,
      status: 'new',
      clinic_id: clinicId,
    })
    setSubmitting(false)
    if (insertError) { setError(insertError.message); return }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Add lead</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name <span className="text-red-400">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="Patient name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Service</label>
            <input value={service} onChange={e => setService(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="e.g. Teeth whitening" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="+44..." />
          </div>
        </div>
        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary-hover flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">
            {submitting ? 'Adding…' : 'Add lead'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Owner: Leads ─────────────────────────────────────────────────────────────

function OwnerLeads({ leads, clinicId, onLeadAdded }: { leads: any[], clinicId: string, onLeadAdded: () => void }) {
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const badgeMap: Record<string, string> = { new: 'bg-emerald-50 text-emerald-700', booked: 'bg-blue-50 text-blue-700', pending: 'bg-amber-50 text-amber-700', urgent: 'bg-red-50 text-red-700' }
  const badgeLabel: Record<string, string> = { new: 'New', booked: 'Booked', pending: 'Pending', urgent: 'Urgent' }
  const filtered = filter === 'all' ? leads : leads.filter(l => l.status === filter)
  return (
    <div className="p-6 animate-fade-in">
      {showModal && (
        <AddLeadModal
          clinicId={clinicId}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); onLeadAdded() }}
        />
      )}
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-lg font-semibold text-gray-900">Leads</h1><p className="text-sm text-gray-500 mt-0.5">All chatbot-captured leads</p></div>
        <button onClick={() => setShowModal(true)} className="btn-primary-hover px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg">Add lead</button>
      </div>
      <div className="flex gap-2 mb-4">
        {['all','new','booked','pending','urgent'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`text-xs px-3 py-1.5 rounded-lg font-medium ${filter === f ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Patient','Service','Phone','Status','Date'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(l => (
              <tr key={l.name} className="client-row cursor-pointer">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${l.avClass}`}>{l.av}</div>
                    <span className="text-sm font-medium text-gray-900">{l.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{l.service}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{l.phone}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeMap[l.status]}`}>{badgeLabel[l.status]}</span></td>
                <td className="px-4 py-3 text-xs text-gray-400">{l.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Agency Dashboard ─────────────────────────────────────────────────────────

function AgencyDashboard({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<AgencyTab>('overview')
  const [clientDetail, setClientDetail] = useState<ClientDetail | null>(null)

  const agencyTabs = [
    { id: 'overview' as AgencyTab, label: 'Overview', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
    { id: 'clients' as AgencyTab, label: 'Clients', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, badge: '4' },
    { id: 'revenue' as AgencyTab, label: 'Revenue', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
    { id: 'whitelabel' as AgencyTab, label: 'White-label', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="21.17" y1="8" x2="12" y2="8"/><line x1="3.95" y1="6.06" x2="8.54" y2="14"/><line x1="10.88" y1="21.94" x2="15.46" y2="14"/></svg> },
    { id: 'settings' as AgencyTab, label: 'Settings', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06-.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
  ]

  const viewClient = (detail: ClientDetail) => {
    setClientDetail(detail)
    setActiveTab('client-detail')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex" style={{ height: '100vh' }}>
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <ToothIcon className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-900">DentaFlow</div>
              <div className="text-xs text-amber-500 font-medium">Agency admin</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {agencyTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`sidebar-item w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-medium ${activeTab === tab.id || (tab.id === 'clients' && activeTab === 'client-detail') ? 'sidebar-item-active' : 'text-gray-500'}`}
            >
              {tab.icon}
              {tab.label}
              {'badge' in tab && tab.badge && (
                <span className="ml-auto bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full font-medium">{tab.badge}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
            <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-semibold flex-shrink-0">DF</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-800">Agency Admin</div>
              <div className="text-xs text-gray-400 truncate">admin@dentaflow.io</div>
            </div>
            <button onClick={onLogout} className="text-gray-400 hover:text-gray-600"><LogoutIcon /></button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-[#111111]">
        {activeTab === 'overview' && <AgencyOverview onViewClients={() => setActiveTab('clients')} onViewClient={viewClient} />}
        {activeTab === 'clients' && <AgencyClients onViewClient={viewClient} />}
        {activeTab === 'client-detail' && clientDetail && <AgencyClientDetail detail={clientDetail} onBack={() => setActiveTab('clients')} />}
        {activeTab === 'revenue' && <PlaceholderTab label="Revenue view" />}
        {activeTab === 'whitelabel' && <PlaceholderTab label="White-label settings" />}
        {activeTab === 'settings' && <PlaceholderTab label="Agency settings" />}
      </main>
    </div>
  )
}

// ─── Agency: Overview ─────────────────────────────────────────────────────────

function AgencyOverview({ onViewClients, onViewClient }: { onViewClients: () => void; onViewClient: (d: ClientDetail) => void }) {
  const [owners, setOwners] = useState<any[]>([])
  const [allLeads, setAllLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: profiles }, { data: leads }] = await Promise.all([
        supabase.from('profiles').select('id, clinic_name, avatar_initials, email'),
        supabase.from('leads').select('id, status, clinic_id'),
      ])
      const ownerProfiles = (profiles || []).filter(
        p => p.role?.trim().toLowerCase() === 'owner'
      )
      setOwners(ownerProfiles)
      setAllLeads(leads || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  const totalLeads = allLeads.length
  const booked = allLeads.filter(l => l.status?.trim().toLowerCase() === 'booked').length
  const conversion = totalLeads > 0 ? Math.round((booked / totalLeads) * 100) : 0

  const kpis = [
    { label: 'Clients',       value: loading ? '—' : String(owners.length) },
    { label: 'Conversations', value: '—' },
    { label: 'Total leads',   value: loading ? '—' : String(totalLeads) },
    { label: 'Appts booked',  value: loading ? '—' : String(booked) },
    { label: 'Conversion',    value: loading ? '—' : `${conversion}%` },
  ]

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Agency overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">Agency dashboard</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {kpis.map(k => (
          <div key={k.label} className="metric-card bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{k.label}</div>
            <div className={`text-2xl font-semibold ${k.value === '—' ? 'text-gray-400' : 'text-gray-900'}`}>{k.value}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Client performance</h3>
            <button onClick={onViewClients} className="text-xs text-blue-600 hover:text-blue-700 font-medium">View all</button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-xs text-gray-400">Loading…</p>
            </div>
          ) : owners.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center">
              <p className="text-xs font-medium text-gray-400">No clients yet</p>
              <p className="text-xs text-gray-400">Clients you add will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {owners.map(c => {
                const clinicLeads = allLeads.filter(l => l.clinic_id === c.id)
                const clinicBooked = clinicLeads.filter(l => l.status?.trim().toLowerCase() === 'booked').length
                return (
                  <div
                    key={c.id}
                    onClick={() => onViewClient({ name: c.clinic_name || c.email, email: c.email, leads: clinicLeads.length, appts: clinicBooked, clinicId: c.id })}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold flex-shrink-0">
                      {c.avatar_initials || '??'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{c.clinic_name || c.email}</div>
                      <div className="text-xs text-gray-400">{clinicLeads.length} leads · {clinicBooked} booked</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Activity feed</h3>
          <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center">
            <p className="text-xs font-medium text-gray-400">No recent activity</p>
            <p className="text-xs text-gray-400">Events will appear here as they happen.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Agency: Clients ──────────────────────────────────────────────────────────

function AgencyClients({ onViewClient }: { onViewClient: (d: ClientDetail) => void }) {
  const clients = [
    { av: 'BS', avClass: 'bg-blue-100 text-blue-700', name: 'Bright Smile Dental', loc: 'London, W1', email: 'owner@brightsmile.com', leads: 61, appts: 38, mrr: '£400/mo', status: 'Live', dot: 'bg-emerald-400' },
    { av: 'OV', avClass: 'bg-emerald-100 text-emerald-700', name: 'Oakview Family Dentistry', loc: 'Manchester, M2', email: 'owner@oakview.com', leads: 44, appts: 29, mrr: '£400/mo', status: 'Live', dot: 'bg-emerald-400' },
    { av: 'MO', avClass: 'bg-purple-100 text-purple-700', name: 'Metro Orthodontics', loc: 'Birmingham, B1', email: 'owner@metroortho.com', leads: 28, appts: 18, mrr: '—', status: 'Trial', dot: 'bg-amber-400' },
    { av: 'WD', avClass: 'bg-orange-100 text-orange-700', name: 'Westside Dental Care', loc: 'Bristol, BS1', email: 'owner@westsidedental.com', leads: 73, appts: 45, mrr: '£400/mo', status: 'Live', dot: 'bg-emerald-400' },
  ]
  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-lg font-semibold text-gray-900">Clients</h1><p className="text-sm text-gray-500 mt-0.5">Manage all dental practices</p></div>
        <button className="btn-primary-hover px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add client
        </button>
      </div>
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Practice','Owner email','Leads','Appts','MRR','Status','Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {clients.map(c => (
              <tr key={c.name} className="client-row">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${c.avClass}`}>{c.av}</div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-400">{c.loc}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{c.email}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.leads}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.appts}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.mrr}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    <span className="text-xs text-gray-600">{c.status}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <button onClick={() => onViewClient({ name: c.name, email: c.email, leads: c.leads, appts: c.appts, clinicId: '' })} className="text-xs px-2.5 py-1 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50">View</button>
                    <button className="text-xs px-2.5 py-1 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50">Edit</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Agency: Client Detail ────────────────────────────────────────────────────

function AgencyClientDetail({ detail, onBack }: { detail: ClientDetail; onBack: () => void }) {
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(!!detail.clinicId)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (!detail.clinicId) { setLoading(false); return }
    supabase
      .from('leads')
      .select('id, name, service, status, created_at')
      .eq('clinic_id', detail.clinicId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setLeads(data || []); setLoading(false) })
  }, [detail.clinicId])

  const booked = leads.filter(l => l.status?.trim().toLowerCase() === 'booked').length

  const badgeMap: Record<string, string> = {
    new: 'bg-emerald-50 text-emerald-700',
    booked: 'bg-blue-50 text-blue-700',
    pending: 'bg-amber-50 text-amber-700',
    urgent: 'bg-red-50 text-red-700',
  }

  const fetchLeads = async () => {
    if (!detail.clinicId) return
    const { data } = await supabase
      .from('leads')
      .select('id, name, service, status, created_at')
      .eq('clinic_id', detail.clinicId)
      .order('created_at', { ascending: false })
    setLeads(data || [])
  }

  return (
    <div className="p-6 animate-fade-in">
      {showModal && (
        <AddLeadModal
          clinicId={detail.clinicId}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchLeads() }}
        />
      )}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600"><BackIcon /></button>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{detail.name}</h1>
          <p className="text-xs text-gray-500">{detail.email}</p>
        </div>
        {detail.clinicId && (
          <button onClick={() => setShowModal(true)} className="ml-auto btn-primary-hover px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg">Add lead</button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[['Leads', leads.length], ['Booked', booked], ['Conversations', '—']].map(([k, v]) => (
          <div key={k} className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">{k}</div>
            <div className={`text-xl font-semibold ${v === '—' ? 'text-gray-400' : 'text-gray-900'}`}>{v}</div>
          </div>
        ))}
      </div>
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Leads</h3>
        {loading ? (
          <p className="text-xs text-gray-400 py-4 text-center">Loading…</p>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center">
            <p className="text-xs font-medium text-gray-400">No leads yet</p>
            <p className="text-xs text-gray-400">Leads captured for this clinic will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {leads.map(l => (
              <div key={l.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{l.name}</div>
                  <div className="text-xs text-gray-400">{l.service || 'General enquiry'}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeMap[l.status?.trim().toLowerCase()] ?? 'bg-gray-100 text-gray-600'}`}>
                  {l.status || 'new'}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {l.created_at ? new Date(l.created_at).toLocaleDateString() : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Chatbot Integration ──────────────────────────────────────────────────────

function ChatbotIntegration({ clinicId }: { clinicId: string }) {
  const snippet = `fetch("https://your-domain.com/api/leads", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    clinic_id: "${clinicId}",
    name: "Patient name",
    service: "Service requested",
    phone: "Patient phone"
  })
})`

  return (
    <div className="p-8 animate-fade-in max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white tracking-tight">Chatbot integration</h1>
        <p className="text-xs text-gray-600 mt-1">Connect an external chatbot widget to capture leads automatically</p>
      </div>
      <div className="space-y-4">
        <div className="bg-[#1a1a1a] border border-white/[0.08] rounded-2xl p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">How it works</h3>
          <ul className="space-y-2 text-xs text-gray-400">
            <li>1. Your chatbot collects the patient&apos;s name, service interest, and phone number.</li>
            <li>2. It sends a POST request to <code className="text-blue-400">/api/leads</code> with that data.</li>
            <li>3. The lead appears instantly in your Leads dashboard and Overview metrics.</li>
          </ul>
        </div>
        <div className="bg-[#1a1a1a] border border-white/[0.08] rounded-2xl p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Required fields</h3>
          <div className="space-y-2">
            {[
              ['clinic_id', clinicId, 'Your unique clinic identifier — already filled in below'],
              ['name', 'string', 'Patient full name'],
              ['service', 'string', 'Service they enquired about (optional)'],
              ['phone', 'string', 'Contact number (optional)'],
            ].map(([field, type, desc]) => (
              <div key={field} className="flex items-start gap-3 text-xs">
                <code className="text-blue-400 w-24 flex-shrink-0">{field}</code>
                <span className="text-gray-600 w-40 flex-shrink-0 truncate">{type}</span>
                <span className="text-gray-500">{desc}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[#1a1a1a] border border-white/[0.08] rounded-2xl p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Example widget code</h3>
          <pre className="text-xs text-gray-300 leading-relaxed overflow-x-auto whitespace-pre">{snippet}</pre>
        </div>
      </div>
    </div>
  )
}

// ─── Placeholder Tab ──────────────────────────────────────────────────────────

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="p-6 flex items-center justify-center h-64 text-gray-400 text-sm animate-fade-in">{label}</div>
  )
}

// ─── Root Component ───────────────────────────────────────────────────────────

export default function DentaFlowApp() {
  const [page, setPage] = useState<Page>('login')
  const [loggedInEmail, setLoggedInEmail] = useState('')
  const [loggedInAccount, setLoggedInAccount] = useState<Account | null>(null)
  const [leads, setLeads] = useState<any[]>([])
const [metrics, setMetrics] = useState({
  conversations: 0,
  leads: 0,
  booked: 0,
  conversion: 0,
})
const loadDashboardData = async (userId: string, userEmail?: string) => {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    alert('Profile not found')
    return false
  }

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('clinic_id', userId)
    .order('created_at', { ascending: false })

  const safeLeads = leads || []

  setLoggedInEmail(profile.email || userEmail || '')
  setLoggedInAccount({
    id: userId,
    pass: '',
    role: profile.role?.trim().toLowerCase() ?? '',
    clinic: profile.clinic_name || '',
    doctor: profile.doctor_name || '',
    av: profile.avatar_initials || '',
  })
  setLeads(safeLeads)
  setMetrics(getMetricsFromLeads(safeLeads))

  if (profile.role === 'agency') {
    setPage('agency-dash')
  } else {
    setPage('owner-dash')
  }

  return true
}
  const handleLogin = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    alert(error.message)
    return
  }

    const user = data.user
  if (!user) return

  await loadDashboardData(user.id, user.email || email)
  }

  const refreshLeads = async (clinicId: string) => {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
    const fresh = data || []
    setLeads(fresh)
    setMetrics(getMetricsFromLeads(fresh))
  }

  const handleLogout = () => {
    setLoggedInEmail('')
    setLoggedInAccount(null)
    setPage('login')
  }

  const normalizedRole = loggedInAccount?.role?.trim().toLowerCase()

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      <div className="h-full bg-gray-50 text-gray-900 antialiased">
        {!loggedInAccount && page === 'signup' && (
          <SignupPage onGoLogin={() => setPage('login')} />
        )}
        {!loggedInAccount && page !== 'signup' && (
          <LoginPage onLogin={handleLogin} onGoSignup={() => setPage('signup')} />
        )}
        {loggedInAccount && normalizedRole === 'agency' && (
          <AgencyDashboard onLogout={handleLogout} />
        )}
        {loggedInAccount && normalizedRole !== 'agency' && (
          <OwnerDashboard
            account={loggedInAccount}
            email={loggedInEmail}
            leads={leads}
            metrics={metrics}
            onLogout={handleLogout}
            onRefreshLeads={refreshLeads}
          />
        )}
      </div>
    </>
  )
}
