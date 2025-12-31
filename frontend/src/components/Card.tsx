
import { ReactNode } from 'react'
import { cn } from '@lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
  variant?: 'default' | 'elevated'
  hoverable?: boolean
}

export default function Card({
  children,
  className = '',
  variant = 'default',
  hoverable = false,
}: CardProps) {
  const baseStyles = 'rounded-lg bg-slate-900 border border-slate-800 p-6'
  const variantStyles = {
    default: 'shadow-md',
    elevated: 'shadow-lg',
  }
  const hoverStyles = hoverable ? 'hover:shadow-lg hover:border-slate-700 transition-all duration-200 cursor-pointer' : ''

  return (
    <div className={cn(baseStyles, variantStyles[variant], hoverStyles, className)}>
      {children}
    </div>
  )
}