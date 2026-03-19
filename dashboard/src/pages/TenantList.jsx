import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listTenants } from '../services/api'

export default function TenantList() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    listTenants({ limit: 100 })
      .then((res) => setTenants(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load tenants'))
      .finally(() => setLoading(false))
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">Tenants</h1>
          <p className="text-slate-400 text-sm">Manage your tenant namespaces.</p>
        </div>
        <Link
          to="/tenants/new"
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
        >
          New tenant
        </Link>
      </div>
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {tenants.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            No tenants yet.{' '}
            <Link to="/tenants/new" className="text-emerald-400 hover:underline">
              Create one
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-700/50 text-slate-300 text-left text-sm">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Namespace</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {tenants.map((t) => (
                <tr key={t.id} className="text-slate-300">
                  <td className="px-4 py-3">
                    <Link to={`/tenants/${t.id}`} className="text-emerald-400 hover:underline font-medium">
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-sm">{t.namespace}</td>
                  <td className="px-4 py-3 text-slate-400 text-sm">
                    {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/tenants/${t.id}`}
                      className="text-sm text-emerald-400 hover:underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
