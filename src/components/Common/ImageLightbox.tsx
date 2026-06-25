import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  src: string;
  alt?: string;
  onClose: () => void;
}

export const ImageLightbox: React.FC<Props> = ({ src, alt = 'Product image', onClose }) => {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-fade-in"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
      >
        <X size={18} />
      </button>

      {/* Image */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
        style={{ maxHeight: '85vh', maxWidth: '85vw' }}
      />

      {/* Label */}
      {alt && (
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 text-sm bg-black/40 px-4 py-1.5 rounded-full backdrop-blur-sm">
          {alt}
        </p>
      )}
    </div>
  );
};
