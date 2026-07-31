import type { MouseEventHandler } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import './TableActionIcon.css'

interface EditTableActionProps {
  to: string
  label: string
}

export function EditTableAction({ to, label }: EditTableActionProps) {
  return (
    <Link
      to={to}
      className="table-action-icon"
      aria-label={label}
      title="Редактировать"
    >
      <Pencil aria-hidden="true" />
    </Link>
  )
}

interface DeleteTableActionProps {
  label: string
  disabled?: boolean
  onClick: MouseEventHandler<HTMLButtonElement>
  title?: string
}

export function DeleteTableAction({
  label,
  disabled,
  onClick,
  title = 'Удалить',
}: DeleteTableActionProps) {
  return (
    <button
      type="button"
      className="table-action-icon table-action-icon--danger"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title}
    >
      <Trash2 aria-hidden="true" />
    </button>
  )
}
