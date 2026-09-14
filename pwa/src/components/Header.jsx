import React from 'react';
import { Globe, LogOut, Shield } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

export default function Header() {
  const { language, toggleLanguage, t } = useLanguage();
  const { logout } = useAuth();
  const { groupProfile } = useData();

  return (
    <header className="sticky top-0 z-40 bg-emerald-800 text-white shadow-md">
      <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left: Group Name */}
        <div className="flex items-center space-x-2.5">
          <div className="bg-emerald-700/80 p-2 rounded-xl border border-emerald-600/50">
            <Shield className="w-5 h-5 text-emerald-200" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight leading-none text-white">
              {language === 'hi' ? groupProfile.hindiName || groupProfile.name : groupProfile.name}
            </h1>
            <span className="text-[11px] text-emerald-200 font-medium">SHG #Patna-04</span>
          </div>
        </div>

        {/* Right: Language Toggle & Logout */}
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleLanguage}
            className="flex items-center space-x-1.5 bg-emerald-700/90 hover:bg-emerald-600 active:scale-95 text-emerald-100 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-600 transition-all shadow-sm font-semibold"
            title="Toggle Language (English / Hindi)"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-300" />
            <span>{language === 'en' ? 'हिन्दी' : 'English'}</span>
          </button>

          <button
            onClick={logout}
            className="p-1.5 bg-emerald-900/60 hover:bg-red-700 text-emerald-200 hover:text-white rounded-lg transition-colors border border-emerald-700"
            title={t('logout')}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
