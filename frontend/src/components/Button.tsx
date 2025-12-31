import { forwardRef, ReactNode, ButtonHTMLAttributes } from 'react'
import { cn } from '@lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  children: ReactNode
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    disabled = false,
    children,
    ...props
  }, ref) => {
    const baseStyles = 'font-medium rounded-md transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'

    const variants = {
      primary: 'bg-cyan-500 text-white hover:bg-cyan-600 active:bg-cyan-700',
      secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700 active:bg-slate-600',
      danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700',
      ghost: 'text-slate-300 hover:bg-slate-800 active:bg-slate-700',
    }

    const sizes = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {isLoading && (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
export default Button
