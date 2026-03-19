import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getTenant, listProjects } from '../services/api'

export default function TenantDetail() {
  const { id } = useParams()
  const [tenant, setTenant] = useState(null)
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([getTenant(id), listProjects(id, { limit: 50 })])
      .then(([tRes, pRes]) => {
        setTenant(tRes.data)
        setProjects(pRes.data)
      })
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-slate-400">Loading…</div>
      </div>
    )
  }

  if (error || !tenant) {
    return (
      <div className="text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        {error || 'Tenant not found'}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <Link to="/tenants" className="text-sm text-slate-400 hover:text-white mb-2 inline-block">
          ← Tenants
        </Link>
        <h1 className="text-2xl font-semibold text-white">{tenant.name}</h1>
        <p className="text-slate-400 text-sm font-mono">{tenant.namespace}</p>
      </div>
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
        <h2 className="text-lg font-medium text-white mb-4">Projects</h2>
        {projects.length === 0 ? (
          <p className="text-slate-400 text-sm mb-4">No projects in this tenant.</p>
        ) : (
          <ul className="space-y-2">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                <span className="text-white font-medium">{p.name}</span>
                <span className={`text-sm px-2 py-0.5 rounded ${
                  p.status === 'deployed' ? 'bg-emerald-500/20 text-emerald-400' :
                  p.status?.startsWith('failed') ? 'bg-red-500/20 text-red-400' :
                  'bg-slate-600 text-slate-300'
                }`}>
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link
          to="/projects/new"
          className="inline-block mt-4 text-sm font-medium text-emerald-400 hover:underline"
        >
          + Deploy project
        </Link>
      </div>
    </div>
  )
}
