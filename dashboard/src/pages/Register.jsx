import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../services/api'

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    padding: 24,
    boxSizing: 'border-box',
  },
  wrapper: {
    width: '100%',
    maxWidth: 420,
  },
  card: {
    background: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 16,
    padding: 40,
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    border: '1px solid rgba(71, 85, 105, 0.5)',
  },
  brandBox: {
    textAlign: 'center',
    marginBottom: 32,
  },
  iconBox: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 12,
    background: 'rgba(16, 185, 129, 0.2)',
    color: '#34d399',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: '#fff',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    margin: '6px 0 0 0',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  errorBox: {
    fontSize: 14,
    color: '#f87171',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: '12px 16px',
  },
  field: {},
  label: {
    display: 'block',
    fontSize: 14,
    fontWeight: 500,
    color: '#cbd5e1',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 12,
    border: '1px solid #475569',
    background: 'rgba(51, 65, 85, 0.8)',
    color: '#fff',
    fontSize: 16,
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(to right, #059669, #10b981)',
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  footer: {
    marginTop: 32,
    textAlign: 'center',
    fontSize: 14,
    color: '#94a3b8',
  },
  link: {
    color: '#34d399',
    fontWeight: 500,
    textDecoration: 'none',
  },
  tagline: {
    textAlign: 'center',
    fontSize: 12,
    color: '#64748b',
    marginTop: 24,
  },
}

export default function Register() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register({ email, username, password })
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <div style={styles.brandBox}>
            <div style={styles.iconBox}>
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h1 style={styles.title}>Create account</h1>
            <p style={styles.subtitle}>GitOps SaaS Platform</p>
          </div>

          <form onSubmit={handleRegister} style={styles.form}>
            {error && <div style={styles.errorBox}>{error}</div>}
            <div style={styles.field}>
              <label style={styles.label} htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label} htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label} htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ ...styles.button, ...(loading ? styles.buttonDisabled : {}) }}
            >
              {loading ? 'Creating account…' : 'Sign up'}
            </button>
          </form>

          <p style={styles.footer}>
            Already have an account?{' '}
            <Link to="/login" style={styles.link}>Sign in</Link>
          </p>
        </div>
        <p style={styles.tagline}>Multi-tenant GitOps deployment platform</p>
      </div>
    </div>
  )
}
