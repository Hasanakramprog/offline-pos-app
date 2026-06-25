import React from 'react';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<Props> = ({
  variant = 'primary', size = 'md', loading, icon, children, className = '', disabled, ...rest
}) => {
  const variantClass = {
    primary:   'btn-primary',
    secondary: 'btn-secondary',
    danger:    'btn-danger',
    ghost:     'btn-ghost',
  }[variant];

  const sizeClass = { sm: 'text-xs px-3 py-1.5', md: '', lg: 'text-base px-6 py-3' }[size];

  return (
    <button
      className={`${variantClass} ${sizeClass} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon}
      {children}
    </button>
  );
};
