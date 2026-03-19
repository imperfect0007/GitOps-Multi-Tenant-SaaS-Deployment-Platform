import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()

  const nav = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/tenants', label: 'Tenants' },
    { path: '/tenants/new', label: 'New Tenant' },
    { path: '/projects/new', label: 'New Project' },
  ]

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex bg-slate-900">
      <aside className="w-56 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <Link to="/dashboard" className="text-lg font-semibold text-white">
            GitOps Platform
          </Link>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={`block px-3 py-2 rounded-lg text-sm font-medium transition ${
                location.pathname === path
                  ? 'bg-emerald-600/20 text-emerald-400'
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-700/50 hover:text-white text-left"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
