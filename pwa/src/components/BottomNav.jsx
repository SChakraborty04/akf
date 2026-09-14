import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, PiggyBank, HandCoins, RotateCcw, BookOpen, Users } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function BottomNav() {
  const { t } = useLanguage();

  const navItems = [
    { path: '/', label: t('navHome'), icon: Home },
    { path: '/deposits', label: t('navDeposits'), icon: PiggyBank },
    { path: '/loans', label: t('navLoans'), icon: HandCoins },
    { path: '/repayments', label: t('navRepayments'), icon: RotateCcw },
    { path: '/ledger', label: t('navLedger'), icon: BookOpen },
    { path: '/profile', label: t('navProfile'), icon: Users }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg max-w-md mx-auto">
      <div className="grid grid-cols-6 h-16 px-1">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center space-y-0.5 text-center transition-all duration-150 rounded-lg py-1 my-1 ${
                  isActive
                    ? 'text-emerald-800 font-bold bg-emerald-50/90 scale-105'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <IconComponent className={`w-5 h-5 ${isActive ? 'text-emerald-700 stroke-[2.5]' : 'stroke-2'}`} />
                  <span className="text-[10px] leading-none tracking-tight truncate w-full px-0.5">
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
