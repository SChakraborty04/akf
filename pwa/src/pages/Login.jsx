import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, User, AlertCircle, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username.trim(), password.trim());
      if (result.success) {
        navigate('/');
      } else {
        setError(result.error || t('loginError'));
      }
    } catch (err) {
      setError(err?.message || t('loginError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between py-8 px-4">
      {/* Language Switcher Top Right */}
      <div className="flex justify-end">
        <button
          onClick={toggleLanguage}
          className="flex items-center space-x-1.5 bg-white text-emerald-800 text-xs px-3 py-1.5 rounded-full shadow-sm border border-slate-200 font-bold hover:bg-slate-50 transition-colors"
        >
          <Globe className="w-3.5 h-3.5 text-emerald-600" />
          <span>{language === 'en' ? 'हिन्दी' : 'English'}</span>
        </button>
      </div>

      {/* Main Login Box */}
      <div className="my-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-3xl shadow-xl mb-2 border border-emerald-100 p-2.5 ring-4 ring-emerald-500/10">
            <img src="/logo-transparent.png" alt="AKF Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            SHG+
          </h1>
          <p className="text-xs font-semibold text-slate-500 max-w-xs mx-auto">
            {t('loginSubtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200 space-y-4">
          {error && (
            <div className="bg-rose-50 text-rose-700 text-xs p-3 rounded-2xl border border-rose-200 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {t('username')}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                autoComplete="username"
                placeholder="Enter operator username (e.g. lakshigroup)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-2xl pl-10 pr-3.5 py-2.5 font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {t('password')}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="Enter operator password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-2xl pl-10 pr-3.5 py-2.5 font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-xs font-extrabold text-white bg-emerald-800 hover:bg-emerald-900 active:scale-98 rounded-2xl shadow-lg transition-all disabled:opacity-60 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <span className="inline-block animate-pulse">Logging in...</span>
            ) : (
              <span>{t('loginBtn')}</span>
            )}
          </button>
        </form>

        <div className="text-center text-[11px] text-slate-400 font-medium">
          Offline-First PWA • Version 1.0.0
        </div>
      </div>

      <div className="h-6"></div>
    </div>
  );
}
