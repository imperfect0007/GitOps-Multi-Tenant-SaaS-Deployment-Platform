import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const API = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const path = window.location.pathname
      if (path !== '/login' && path !== '/register') {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// Auth
export const register = (data) => API.post('/auth/register', data)
export const login = (data) => API.post('/auth/login', data)
export const getMe = () => API.get('/auth/me')

// Tenants
export const createTenant = (data) => API.post('/tenants/', data)
export const listTenants = (params = {}) => API.get('/tenants/', { params })
export const getTenant = (id) => API.get(`/tenants/${id}`)
export const deleteTenant = (id) => API.delete(`/tenants/${id}`)

// Projects (require tenant_id)
export const createProject = (tenantId, data) =>
  API.post(`/tenants/${tenantId}/projects`, data)
export const listProjects = (tenantId, params = {}) =>
  API.get(`/tenants/${tenantId}/projects`, { params })
export const getProject = (id) => API.get(`/projects/${id}`)
export const deleteProject = (id) => API.delete(`/projects/${id}`)

// Deployments
export const listDeployments = (tenantId, params = {}) =>
  API.get(`/tenants/${tenantId}/deployments`, { params })
export const getDeploymentStatus = (projectId) =>
  API.get(`/deployments/${projectId}/status`)

// K8s monitoring (Day 8)
export const getK8sDeployments = (tenantId) =>
  API.get(`/tenants/${tenantId}/k8s/deployments`)
export const getK8sPods = (tenantId) =>
  API.get(`/tenants/${tenantId}/k8s/pods`)
export const getPodLogs = (tenantId, podName, params = {}) =>
  API.get(`/tenants/${tenantId}/k8s/logs/${encodeURIComponent(podName)}`, { params })

export default API
