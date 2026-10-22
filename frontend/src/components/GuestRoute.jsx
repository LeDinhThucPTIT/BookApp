import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/auth-context'

export default function GuestRoute() {
  const { user, loading } = useAuth()
  if (loading) {
    return <p style={{ padding: 40, textAlign: 'center' }}>Đang tải...</p>
  }
  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/home'} replace />
  }
  return <Outlet />
}
