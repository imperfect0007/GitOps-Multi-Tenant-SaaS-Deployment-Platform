import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTenant } from '../services/api'

export default function CreateTenant() {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await createTenant({ name: name.trim() })
      navigate('/tenants', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create tenant')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-1">Create tenant</h1>
      <p className="text-slate-400 text-sm mb-6">
        A tenant gets its own Kubernetes namespace and resource limits.
      </p>
      <div className="max-w-md">
        <form onSubmit={handleCreate} className="space-y-4">
          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Tenant name</label>
            <input
              type="text"
              placeholder="e.g. acme-corp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              required
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create tenant'}
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
