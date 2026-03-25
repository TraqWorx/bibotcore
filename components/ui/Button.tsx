'use client'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
}

export default function Button({ children, variant = 'primary', className = '', ...props }: ButtonProps) {
  const base = 'rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 ease-out disabled:opacity-50'
  const variants = {
    primary: 'bg-black text-white hover:bg-gray-900 border border-black',
    secondary: 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-200',
  }

  return (
    <button type="button" {...props} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  )
}
