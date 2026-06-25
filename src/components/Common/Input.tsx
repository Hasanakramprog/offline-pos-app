import React from 'react';

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input: React.FC<Props> = ({ label, error, leftIcon, className = '', ...rest }) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-sm font-medium text-pos-muted">{label}</label>}
    <div className="relative">
      {leftIcon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-pos-muted">{leftIcon}</span>
      )}
      <input
        className={`input ${leftIcon ? 'pl-10' : ''} ${error ? 'border-pos-danger' : ''} ${className}`}
        {...rest}
      />
    </div>
    {error && <p className="text-xs text-pos-danger">{error}</p>}
  </div>
);
