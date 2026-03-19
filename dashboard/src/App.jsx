import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import TenantList from './pages/TenantList'
import TenantDetail from './pages/TenantDetail'
import CreateTenant from './pages/CreateTenant'
import CreateProject from './pages/CreateProject'
import Monitoring from './pages/Monitoring'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="tenants" element={<TenantList />} />
          <Route path="tenants/new" element={<CreateTenant />} />
          <Route path="tenants/:id" element={<TenantDetail />} />
          <Route path="projects/new" element={<CreateProject />} />
          <Route path="monitoring" element={<Monitoring />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
