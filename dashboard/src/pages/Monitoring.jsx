import { useState, useEffect, useCallback } from 'react'
import { listTenants, getK8sDeployments, getK8sPods, getPodLogs } from '../services/api'

const styles = {
  page: { maxWidth: 1000 },
  title: { fontSize: 24, fontWeight: 700, color: '#fff', margin: '0 0 8px 0' },
  subtitle: { fontSize: 14, color: '#94a3b8', margin: '0 0 24px 0' },
  select: {
    marginBottom: 24,
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid #475569',
    background: 'rgba(30, 41, 59, 0.9)',
    color: '#fff',
    fontSize: 14,
    minWidth: 220,
  },
  tableWrap: {
    background: 'rgba(30, 41, 59, 0.9)',
    borderRadius: 16,
    border: '1px solid rgba(71, 85, 105, 0.5)',
    overflow: 'hidden',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    padding: '14px 16px',
    fontSize: 12,
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    background: 'rgba(15, 23, 42, 0.5)',
    borderBottom: '1px solid rgba(71, 85, 105, 0.5)',
  },
  td: {
    padding: '14px 16px',
    fontSize: 14,
    color: '#e2e8f0',
    borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
  },
  statusRunning: { color: '#34d399', fontWeight: 600 },
  statusFailed: { color: '#f87171', fontWeight: 600 },
  statusPending: { color: '#fbbf24', fontWeight: 600 },
  button: {
    padding: '6px 12px',
    borderRadius: 8,
    border: 'none',
    background: 'rgba(16, 185, 129, 0.2)',
    color: '#34d399',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  empty: { padding: 40, textAlign: 'center', color: '#64748b', fontSize: 14 },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    padding: 24,
  },
  modal: {
    background: '#1e293b',
    borderRadius: 16,
    border: '1px solid #475569',
    maxWidth: 640,
    width: '100%',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid #334155',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 16, fontWeight: 600, color: '#fff', margin: 0 },
  modalClose: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: 4,
    fontSize: 20,
    lineHeight: 1,
  },
  modalBody: { padding: 20, overflow: 'auto', flex: 1 },
  logPre: {
    margin: 0,
    padding: 16,
    background: '#0f172a',
    borderRadius: 12,
    fontSize: 12,
    fontFamily: 'ui-monospace, monospace',
    color: '#94a3b8',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    maxHeight: 400,
    overflow: 'auto',
  },
  podList: { listStyle: 'none', padding: 0, margin: '0 0 16px 0' },
  podItem: {
    padding: '10px 14px',
    background: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 8,
    marginBottom: 8,
    color: '#e2e8f0',
    cursor: 'pointer',
    fontSize: 14,
  },
  tailSelect: {
    marginBottom: 12,
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #475569',
    background: '#0f172a',
    color: '#fff',
    fontSize: 13,
  },
  refreshNote: { fontSize: 12, color: '#64748b', marginTop: 16 },
}

export default function Monitoring() {
  const [tenants, setTenants] = useState([])
  const [tenantId, setTenantId] = useState('')
  const [deployments, setDeployments] = useState([])
  const [pods, setPods] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [logModal, setLogModal] = useState(null)
  const [logs, setLogs] = useState('')
  const [logsLoading, setLogsLoading] = useState(false)
  const [tailLines, setTailLines] = useState(100)

  const fetchK8s = useCallback(async () => {
    if (!tenantId) return
    try {
      const [dRes, pRes] = await Promise.all([
        getK8sDeployments(Number(tenantId)),
        getK8sPods(Number(tenantId)),
      ])
      setDeployments(Array.isArray(dRes.data) ? dRes.data : [])
      setPods(Array.isArray(pRes.data) ? pRes.data : [])
      setError('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load K8s data')
      setDeployments([])
      setPods([])
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    listTenants({ limit: 100 })
      .then((res) => {
        setTenants(res.data)
        if (res.data.length && !tenantId) setTenantId(String(res.data[0].id))
      })
      .catch(() => setError('Failed to load tenants'))
  }, [])

  useEffect(() => {
    if (!tenantId) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetchK8s()
  }, [tenantId, fetchK8s])

  useEffect(() => {
    if (!tenantId) return
    const interval = setInterval(fetchK8s, 5000)
    return () => clearInterval(interval)
  }, [tenantId, fetchK8s])

  const openLogModal = (deploymentName) => {
    const deploymentPods = pods.filter((p) => p.app === deploymentName)
    setLogModal({ deploymentName, pods: deploymentPods })
    setLogs('')
  }

  const loadLogs = async (podName) => {
    if (!tenantId || !podName) return
    setLogsLoading(true)
    try {
      const res = await getPodLogs(Number(tenantId), podName, { tail: tailLines })
      setLogs(res.data.logs || '')
    } catch {
      setLogs('[Failed to load logs]')
    } finally {
      setLogsLoading(false)
    }
  }

  const tenant = tenants.find((t) => String(t.id) === tenantId)
  const namespace = tenant?.namespace || ''

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Deployment Monitoring</h1>
      <p style={styles.subtitle}>
        Live status and logs from your tenant namespace. Data refreshes every 5 seconds.
      </p>

      <select
        value={tenantId}
        onChange={(e) => setTenantId(e.target.value)}
        style={styles.select}
      >
        <option value="">Select tenant</option>
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({t.namespace})
          </option>
        ))}
      </select>

      {error && (
        <div style={{ ...styles.empty, color: '#f87171', textAlign: 'left', padding: '12px 16px', background: 'rgba(239,68,68,0.1)', borderRadius: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading && tenantId ? (
        <p style={styles.empty}>Loading deployments…</p>
      ) : !tenantId ? (
        <p style={styles.empty}>Select a tenant to view deployments.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Deployment</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Pods</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deployments.length === 0 ? (
                <tr>
                  <td colSpan={4} style={styles.empty}>
                    No deployments in this namespace. Deploy a project first.
                  </td>
                </tr>
              ) : (
                deployments.map((d) => (
                  <tr key={d.name}>
                    <td style={styles.td}>{d.name}</td>
                    <td style={styles.td}>
                      <span
                        style={
                          d.status === 'Running'
                            ? styles.statusRunning
                            : d.status === 'Failed'
                            ? styles.statusFailed
                            : styles.statusPending
                        }
                      >
                        {d.status}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {d.ready_replicas}/{d.desired_replicas}
                    </td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        style={styles.button}
                        onClick={() => openLogModal(d.name)}
                      >
                        View Logs
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <p style={styles.refreshNote}>Auto-refresh every 5 seconds</p>

      {logModal && (
        <div
          style={styles.modalOverlay}
          onClick={() => setLogModal(null)}
          onKeyDown={(e) => e.key === 'Escape' && setLogModal(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={styles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                Logs — {logModal.deploymentName} ({namespace})
              </h2>
              <button
                type="button"
                style={styles.modalClose}
                onClick={() => setLogModal(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div style={styles.modalBody}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#94a3b8' }}>
                Tail lines:{' '}
                <select
                  value={tailLines}
                  onChange={(e) => setTailLines(Number(e.target.value))}
                  style={styles.tailSelect}
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                </select>
              </label>
              {logModal.pods.length === 0 ? (
                <p style={{ color: '#64748b', margin: 0 }}>No pods for this deployment.</p>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 8px 0' }}>Select a pod:</p>
                  <ul style={styles.podList}>
                    {logModal.pods.map((p) => (
                      <li
                        key={p.name}
                        style={styles.podItem}
                        onClick={() => loadLogs(p.name)}
                        onKeyDown={(e) => e.key === 'Enter' && loadLogs(p.name)}
                        role="button"
                        tabIndex={0}
                      >
                        {p.name} — {p.status}
                      </li>
                    ))}
                  </ul>
                  {logsLoading ? (
                    <p style={{ color: '#94a3b8' }}>Loading logs…</p>
                  ) : (
                    logs && <pre style={styles.logPre}>{logs}</pre>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
