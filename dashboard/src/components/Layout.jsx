import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()

  const nav = [
    { path: '/dashboard', label: 'Dashboard', icon: 'M4 6h16M4 12h16M4 18h16' },
    { path: '/tenants', label: 'Tenants', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16h14a2 2 0 002-2V5a2 2 0 00-2-2h-2M9 7h6m-4 4h4m-4 4h4' },
    { path: '/tenants/new', label: 'New Tenant', icon: 'M12 4v16m8-8H4' },
    { path: '/projects/new', label: 'New Project', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
    { path: '/monitoring', label: 'Monitoring', icon: 'M9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4zm2 2H5V5h14v14z' },
  ]

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800">
      <aside className="w-60 bg-slate-800/80 backdrop-blur border-r border-slate-700/80 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-700/80">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white tracking-tight">GitOps Platform</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {nav.map(({ path, label, icon }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                location.pathname === path
                  ? 'bg-emerald-500/15 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
              </svg>
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-700/80">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-700/50 hover:text-white text-left transition-all"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6 md:p-8">
        <Outlet />
      </main>
    </div>
  )
}
