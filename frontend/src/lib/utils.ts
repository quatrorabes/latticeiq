
import clsx, { type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatTime(date: string | Date) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getInitials(firstName: string, lastName: string) {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()
}

export function getDisplayName(firstName: string, lastName: string) {
  return [firstName, lastName].filter(Boolean).join(' ')
}

export function formatScore(score: number | null | undefined) {
  if (!score) return 'N/A'
  return Math.round(score)
}

export function getScoreColor(score: number | null | undefined) {
  if (!score) return 'bg-slate-700'
  if (score >= 80) return 'bg-success'
  if (score >= 60) return 'bg-warning'
  return 'bg-error'
}

export function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    completed: 'bg-success text-white',
    processing: 'bg-warning text-black',
    pending: 'bg-slate-700 text-slate-300',
    failed: 'bg-error text-white',
  }
  return colors[status] || 'bg-slate-700 text-slate-300'
}

export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function truncate(str: string, length: number) {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}