import React, { useState, useEffect } from 'react';
import { Share, PlusSquare, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function IOSInstallPrompt() {
  const { t } = useLanguage();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    // Check if running in standalone mode (already installed as PWA)
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    // Check if dismissed in this session
    const isDismissed = sessionStorage.getItem('ios_pwa_prompt_dismissed') === 'true';

    if (isIOS && !isStandalone && !isDismissed) {
      setShowPrompt(true);
    }
  }, []);

  const dismissPrompt = () => {
    sessionStorage.setItem('ios_pwa_prompt_dismissed', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-16 left-0 right-0 z-50 px-4 max-w-md mx-auto animate-bounce-short">
      <div className="bg-emerald-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-emerald-500/30 text-xs flex items-start space-x-3 relative">
        <div className="bg-emerald-700/80 p-2 rounded-xl shrink-0 text-emerald-200">
          <Share className="w-5 h-5 animate-pulse" />
        </div>
        <div className="flex-1 pr-4 leading-relaxed">
          <p className="font-semibold text-sm mb-0.5 text-emerald-100">{t('iosInstallTitle')}</p>
          <p className="text-emerald-200/90">
            {t('iosInstallText')}{' '}
            <span className="inline-flex items-center bg-emerald-800 px-1.5 py-0.5 rounded font-mono text-[11px] text-white">
              <Share className="w-3 h-3 mx-0.5" />
            </span>{' '}
            {t('iosInstallStep2')}{' '}
            <span className="inline-flex items-center bg-emerald-800 px-1.5 py-0.5 rounded font-mono text-[11px] text-white">
              <PlusSquare className="w-3 h-3 mx-0.5" />
            </span>
          </p>
        </div>
        <button
          onClick={dismissPrompt}
          className="text-emerald-300 hover:text-white p-1 rounded-lg hover:bg-emerald-800/50 transition-colors"
          aria-label="Close prompt"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
