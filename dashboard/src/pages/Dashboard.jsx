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
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-slate-400">Loading…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        {error}
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-1">Dashboard</h1>
      <p className="text-slate-400 text-sm mb-8">
        Welcome back{user?.username ? `, ${user.username}` : ''}.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-lg font-medium text-white mb-4">Your tenants</h2>
          {tenants.length === 0 ? (
            <p className="text-slate-400 text-sm mb-4">No tenants yet.</p>
          ) : (
            <ul className="space-y-2 mb-4">
              {tenants.map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/tenants/${t.id}`}
                    className="text-emerald-400 hover:underline"
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
            className="inline-block text-sm font-medium text-emerald-400 hover:underline"
          >
            + Create tenant
          </Link>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-lg font-medium text-white mb-4">Quick actions</h2>
          <ul className="space-y-2">
            <li>
              <Link
                to="/tenants/new"
                className="text-emerald-400 hover:underline"
              >
                Create a tenant
              </Link>
            </li>
            <li>
              <Link
                to="/projects/new"
                className="text-emerald-400 hover:underline"
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
