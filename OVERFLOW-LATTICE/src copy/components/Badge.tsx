
import { cn } from '@lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const variants = {
  default: 'bg-slate-700 text-slate-100',
  success: 'bg-success/20 text-success border border-success/30',
  warning: 'bg-warning/20 text-warning border border-warning/30',
  error: 'bg-error/20 text-error border border-error/30',
  info: 'bg-primary-500/20 text-primary-300 border border-primary-500/30',
}

const sizes = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-2 text-base',
}

export default function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className,
}: BadgeProps) {
  return (
    <span className={cn(
      'inline-block rounded-full font-medium whitespace-nowrap',
      variants[variant],
      sizes[size],
      className
    )}>
      {children}
    </span>
  )
}