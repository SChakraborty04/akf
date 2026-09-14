import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';
import IOSInstallPrompt from './IOSInstallPrompt';

export default function Layout() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased selection:bg-emerald-500 selection:text-white">
      <div className="max-w-md mx-auto w-full min-h-screen bg-slate-50 flex flex-col relative pb-20 shadow-2xl border-x border-slate-200">
        {!isLoginPage && <Header />}
        
        <main className="flex-1 px-4 py-4 overflow-y-auto">
          <Outlet />
        </main>

        {!isLoginPage && <BottomNav />}
        <IOSInstallPrompt />
      </div>
    </div>
  );
}
