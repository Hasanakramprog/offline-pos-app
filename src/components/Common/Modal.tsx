import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnBackdrop?: boolean;
}

export const Modal: React.FC<Props> = ({ open, onClose, title, children, footer, size = 'md', closeOnBackdrop = true }) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => closeOnBackdrop && e.target === e.currentTarget && onClose()}
    >
      <div className={`bg-pos-surface border border-pos-border rounded-2xl w-full ${widths[size]} shadow-2xl`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-pos-border">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-pos-muted hover:text-pos-text transition-colors">
            <X size={20} />
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-4">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-pos-border">{footer}</div>
        )}
      </div>
    </div>
  );
};
