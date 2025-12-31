
import { forwardRef, InputHTMLAttributes } from 'react'
import { cn } from '@lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helpText?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helpText, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {label}
            {props.required && <span className="text-error ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full px-4 py-2 rounded-md bg-slate-800 border border-slate-700 text-white placeholder-slate-500',
            'focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none',
            'transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-error focus:border-error focus:ring-error/20',
            className
          )}
          {...props}
        />
        {error && <p className="text-error text-sm mt-1">{error}</p>}
        {helpText && <p className="text-slate-400 text-sm mt-1">{helpText}</p>}
      </div>
    )
  }
)


Input.displayName = 'Input'
export default Input