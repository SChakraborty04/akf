import React from 'react';
import {
  Building2,
  ChevronRight,
  Database,
  HandCoins,
  Home,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import type { MISUser } from '../types';

export type NavPage = 'home' | 'shg-list' | 'finance' | 'master' | 'settings';

interface SidebarProps {
  activePage: NavPage;
  onSelectPage: (page: NavPage) => void;
  pendingApprovalsCount?: number;
  currentUser?: MISUser | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onSelectPage,
  pendingApprovalsCount = 0,
  currentUser,
  onLogout,
}) => {
  const navItems = [
    {
      id: 'home' as NavPage,
      label: 'Home',
      icon: Home,
      description: 'MIS Dashboard & KPIs',
    },
    {
      id: 'shg-list' as NavPage,
      label: 'SHG List',
      icon: Building2,
      description: 'Regional Hierarchy Directory',
    },
    {
      id: 'finance' as NavPage,
      label: 'Finance',
      icon: HandCoins,
      description: 'Approvals & Ledger Feed',
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
    },
    {
      id: 'master' as NavPage,
      label: 'Master',
      icon: Database,
      description: 'SHG, Members & Users',
    },
    {
      id: 'settings' as NavPage,
      label: 'Settings',
      icon: SettingsIcon,
      description: 'Interest, Limits & Access',
    },
  ];

  return (
    <aside className="w-72 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col shrink-0 min-h-screen select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-base tracking-tight">SHG+</span>
              <span className="text-[10px] uppercase font-semibold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">
                MIS
              </span>
            </div>
            <p className="text-xs text-slate-400">Enterprise Administration</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
          Core Operations
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectPage(item.id)}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-left transition-all group ${
                isActive
                  ? 'bg-gradient-to-r from-emerald-500/15 to-teal-500/5 text-white font-semibold border border-emerald-500/30 shadow-sm'
                  : 'hover:bg-slate-800/60 text-slate-300 hover:text-white'
              }`}
            >
              <div
                className={`p-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm truncate">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="bg-amber-500 text-slate-950 text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 truncate font-normal">{item.description}</p>
              </div>
              <ChevronRight
                className={`w-3.5 h-3.5 text-slate-500 transition-transform ${
                  isActive ? 'opacity-100 translate-x-0.5 text-emerald-400' : 'opacity-0 -translate-x-1 group-hover:opacity-100'
                }`}
              />
            </button>
          );
        })}
      </nav>

      {/* Admin Context Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-2">
        <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate">
              {currentUser?.fullName || currentUser?.username || 'Administrator'}
            </div>
            <div className="text-[11px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
              <span>
                {currentUser?.role === 'super_admin'
                  ? 'Super Admin Control'
                  : currentUser?.role === 'admin'
                  ? 'Regional Admin'
                  : 'MIS Session Active'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1">
          <span>Backend: Live</span>
          {onLogout && (
            <button
              onClick={onLogout}
              className="text-rose-400 hover:text-rose-300 font-semibold transition cursor-pointer"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
