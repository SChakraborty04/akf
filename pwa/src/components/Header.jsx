import React from 'react';
import { Globe, LogOut } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { translations } from '../localization/translations';
import LoadingButton from './LoadingButton';

export default function Header() {
  const { language, toggleLanguage, t } = useLanguage();
  const { logout, user } = useAuth();
  const { groupProfile } = useData();
  const toast = useToast();

  const handleToggleLanguage = () => {
    const nextLang = language === 'en' ? 'hi' : 'en';
    toggleLanguage();
    toast.success(translations[nextLang]?.langSwitched || 'Language updated');
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success(t('loggedOutSuccess'));
    } catch (err) {
      toast.error(err?.message || t('logoutFailed'));
    }
  };

  return (
    <header className="sticky top-0 z-40 h-[60px] bg-emerald-800 text-white shadow-md flex items-center">
      <div className="max-w-md w-full mx-auto px-4 flex items-center justify-between gap-2">
        {/* Left: Group Name */}
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="bg-white p-1 rounded-xl shadow-sm border border-emerald-400/40 w-9 h-9 flex items-center justify-center shrink-0">
            <img src="/logo-transparent.png" alt="AKF Logo" className="w-6 h-6 object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base tracking-tight leading-none text-white truncate">
              {language === 'hi' ? groupProfile?.hindiName || groupProfile?.name : groupProfile?.name}
            </h1>
            <span className="text-[11px] text-emerald-200 font-medium block truncate mt-0.5">
              {user?.username ? `@${user.username}` : (groupProfile?.district || 'SHG Member')}
            </span>
          </div>
        </div>

        {/* Right: Language Toggle & Logout */}
        <div className="flex items-center space-x-2 shrink-0">
          <LoadingButton
            onClick={handleToggleLanguage}
            spinnerClassName="w-3.5 h-3.5 text-emerald-200"
            className="flex items-center space-x-1.5 bg-emerald-700/90 hover:bg-emerald-600 active:scale-95 text-emerald-100 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-600 transition-all shadow-sm font-semibold cursor-pointer"
            title="Toggle Language (English / Hindi)"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            <span>{language === 'en' ? 'हिन्दी' : 'English'}</span>
          </LoadingButton>

          <LoadingButton
            iconOnly
            onClick={handleLogout}
            spinnerClassName="w-4 h-4 text-emerald-200"
            className="p-1.5 bg-emerald-900/60 hover:bg-red-700 text-emerald-200 hover:text-white rounded-lg transition-colors border border-emerald-700 flex items-center justify-center cursor-pointer"
            title={t('logout')}
            aria-label={t('logout')}
          >
            <LogOut className="w-4 h-4" />
          </LoadingButton>
        </div>
      </div>
    </header>
  );
}
