import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'

/**
 * Пропускает только администраторов (is_staff).
 * Всех остальных редиректит на главную.
 */
export function RequireAdmin() {
  const { isStaff } = useAuth()

  if (!isStaff) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
