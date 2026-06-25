import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToastStore } from '../../store/toastStore';

const icons = {
  success: <CheckCircle size={18} className="text-pos-success" />,
  error:   <XCircle    size={18} className="text-pos-danger"  />,
  warning: <AlertTriangle size={18} className="text-pos-warning" />,
  info:    <Info       size={18} className="text-pos-primary" />,
};

const borders = {
  success: 'border-pos-success/40',
  error:   'border-pos-danger/40',
  warning: 'border-pos-warning/40',
  info:    'border-pos-primary/40',
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl
                      bg-pos-surface border ${borders[t.type]} shadow-xl
                      animate-in slide-in-from-right duration-300 min-w-64 max-w-sm`}
        >
          {icons[t.type]}
          <span className="text-sm flex-1">{t.message}</span>
          <button onClick={() => removeToast(t.id)} className="text-pos-muted hover:text-pos-text">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
