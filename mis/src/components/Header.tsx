import React, { useState } from 'react';
import { KeyRound, LogOut, RefreshCw } from 'lucide-react';
import type { MISUser } from '../types';
import type { NavPage } from './Sidebar';
import { ChangePasswordModal } from './ChangePasswordModal';

interface HeaderProps {
  activePage: NavPage;
  onRefresh: () => void;
  isRefreshing?: boolean;
  pendingCount?: number;
  onViewApprovals?: () => void;
  currentUser?: MISUser | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activePage,
  onRefresh,
  isRefreshing = false,
  pendingCount = 0,
  onViewApprovals,
  currentUser,
  onLogout,
}) => {
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const titles: Record<NavPage, { title: string; subtitle: string }> = {
    home: {
      title: 'Executive MIS Dashboard',
      subtitle: 'Overview of Self Help Groups, regional performance, and real-time operations',
    },
    'shg-list': {
      title: 'SHG Directory & Hierarchy Search',
      subtitle: 'Search and filter Self Help Groups by State, District, Block, and Panchayat',
    },
    finance: {
      title: 'Finance & Transaction Approval',
      subtitle: 'Verify member deposits, approve loan disbursements, and audit comprehensive ledgers',
    },
    master: {
      title: 'Master Data & Configuration',
      subtitle: 'Provision new SHGs with login credentials, register members, and bulk upload files',
    },
    settings: {
      title: 'System Settings & Controls',
      subtitle: 'Configure interest rates, maximum loan limits, stamp denominations, and access policies',
    },
  };

  const current = titles[activePage];
  const userInitials =
    currentUser?.fullName
      ?.split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'SA';

  const roleLabel =
    currentUser?.role === 'super_admin'
      ? 'Super Administrator'
      : currentUser?.role === 'admin'
      ? 'Regional Administrator'
      : currentUser?.role || 'Administrator';

  return (
    <header className="h-20 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-8 flex items-center justify-between sticky top-0 z-20 shadow-md">
      <div>
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">{current.title}</h1>
        <p className="text-xs text-slate-400 mt-0.5">{current.subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {pendingCount > 0 && (
          <button
            onClick={onViewApprovals}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition text-xs font-semibold cursor-pointer shadow-sm"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            <span>{pendingCount} Pending Approvals</span>
          </button>
        )}

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-xs font-medium transition border border-slate-700/80 cursor-pointer disabled:opacity-50"
          title="Refresh Data from Server"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh</span>
        </button>

        <div className="h-6 w-px bg-slate-800 mx-1"></div>

        {/* Current User Profile Pill */}
        <div className="flex items-center gap-2.5 pl-1">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-bold text-xs shadow-sm">
            {userInitials}
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-semibold text-slate-200 leading-tight">
              {currentUser?.fullName || currentUser?.username || 'Super Admin'}
            </div>
            <div className="text-[10px] text-emerald-400 font-medium">{roleLabel}</div>
          </div>
        </div>

        {/* Change Password Button */}
        <button
          onClick={() => setIsPasswordModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-xs font-medium transition border border-slate-700/80 cursor-pointer shadow-sm ml-1"
          title="Change Administrator Password"
        >
          <KeyRound className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden md:inline">Change Password</span>
        </button>

        {/* Logout Button */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition border border-rose-500/30 cursor-pointer shadow-sm ml-1"
            title="Sign out of MIS session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        )}
      </div>

      {/* Admin Password Change Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        username={currentUser?.username}
      />
    </header>
  );
};
