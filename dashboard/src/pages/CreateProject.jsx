import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createProject, listTenants } from '../services/api'

export default function CreateProject() {
  const [tenants, setTenants] = useState([])
  const [tenantId, setTenantId] = useState('')
  const [name, setName] = useState('')
  const [image, setImage] = useState('nginx:1.27-alpine')
  const [replicas, setReplicas] = useState(2)
  const [port, setPort] = useState(80)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingTenants, setLoadingTenants] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    listTenants({ limit: 100 })
      .then((res) => {
        setTenants(res.data)
        if (res.data.length && !tenantId) setTenantId(String(res.data[0].id))
      })
      .catch(() => setError('Failed to load tenants'))
      .finally(() => setLoadingTenants(false))
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!tenantId) {
      setError('Select a tenant')
      return
    }
    setError('')
    setLoading(true)
    try {
      await createProject(Number(tenantId), {
        name: name.trim(),
        image,
        replicas,
        port,
      })
      navigate(`/tenants/${tenantId}`, { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  if (loadingTenants) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-slate-400">Loading tenants…</div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-1">Deploy project</h1>
      <p className="text-slate-400 text-sm mb-6">
        Create a project to trigger a GitOps deployment in the selected tenant.
      </p>
      <div className="max-w-md">
        <form onSubmit={handleCreate} className="space-y-4">
          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Tenant</label>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              required
            >
              <option value="">Select tenant</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.namespace})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Project name</label>
            <input
              type="text"
              placeholder="e.g. web-app"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Image</label>
            <input
              type="text"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Replicas</label>
              <input
                type="number"
                min={1}
                max={10}
                value={replicas}
                onChange={(e) => setReplicas(Number(e.target.value))}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Port</label>
              <input
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition disabled:opacity-50"
            >
              {loading ? 'Deploying…' : 'Deploy'}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
