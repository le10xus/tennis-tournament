import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

/**
 * Пропускает только организаторов и администраторов.
 * Игроков редиректит на родительскую страницу списка.
 */
export function RequireEdit() {
  const { canEdit } = useAuth()
  const location = useLocation()

  if (!canEdit) {
    // убираем /new или /:id/edit → получаем страницу списка
    const listPath = location.pathname.replace(/\/(new|[^/]+\/edit)$/, '') || '/'
    return <Navigate to={listPath} replace />
  }

  return <Outlet />
}
