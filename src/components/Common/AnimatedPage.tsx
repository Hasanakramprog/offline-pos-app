import React from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Wraps page content with a fade+slide-up entrance animation.
 * Uses `key={pathname}` so the animation replays on every route change.
 */
export const AnimatedPage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();

  return (
    <div key={pathname} className="animate-page-enter h-full">
      {children}
    </div>
  );
};
