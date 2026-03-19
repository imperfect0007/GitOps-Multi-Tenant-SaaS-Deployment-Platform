import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listTenants, getMe } from '../services/api'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [meRes, tenantsRes] = await Promise.all([getMe(), listTenants({ limit: 10 })])
        setUser(meRes.data)
        setTenants(tenantsRes.data)
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <svg className="animate-spin h-8 w-8 text-emerald-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 flex items-center gap-2 max-w-md">
        <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        {error}
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Dashboard</h1>
      <p className="text-slate-400 text-sm mb-8">
        Welcome back{user?.username ? `, ${user.username}` : ''}.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700/80 p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-4">Your tenants</h2>
          {tenants.length === 0 ? (
            <p className="text-slate-400 text-sm mb-4">No tenants yet.</p>
          ) : (
            <ul className="space-y-2 mb-4">
              {tenants.map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/tenants/${t.id}`}
                    className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                  >
                    {t.name}
                  </Link>
                  <span className="text-slate-500 text-sm ml-2">({t.namespace})</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/tenants/new"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <span className="text-lg leading-none">+</span> Create tenant
          </Link>
        </div>

        <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700/80 p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-4">Quick actions</h2>
          <ul className="space-y-3">
            <li>
              <Link
                to="/tenants/new"
                className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                Create a tenant
              </Link>
            </li>
            <li>
              <Link
                to="/projects/new"
                className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                Deploy a project
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
