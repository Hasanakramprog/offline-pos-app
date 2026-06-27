import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ToastContainer } from '../Common/Toast';
import { AnimatedPage } from '../Common/AnimatedPage';

export const Layout: React.FC = () => (
  <div className="flex h-screen overflow-hidden bg-pos-bg">
    <Sidebar />
    <main className="flex-1 overflow-y-auto">
      <AnimatedPage>
        <Outlet />
      </AnimatedPage>
    </main>
    <ToastContainer />
  </div>
);
