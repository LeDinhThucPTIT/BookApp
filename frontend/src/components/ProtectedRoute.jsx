import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/auth-context'

export default function ProtectedRoute({ adminOnly = false }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <p style={{ padding: 40, textAlign: 'center' }}>Đang tải...</p>
  }
  if (!user) return <Navigate to="/" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/home" replace />
  return <Outlet />
}
