import React from 'react';
import { PiggyBank, HandCoins, Wallet, TrendingUp } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency } from '../utils/formatters';

export default function SummaryCard({ summary }) {
  const { t } = useLanguage();

  return (
    <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 rounded-2xl p-4 text-white shadow-lg border border-emerald-700/50 mb-5 relative overflow-hidden">
      {/* Subtle decorative background circles */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl pointer-events-none"></div>

      <div className="grid grid-cols-2 gap-3 relative z-10">
        {/* 1. Total Saving */}
        <div className="bg-emerald-950/50 backdrop-blur-sm p-3 rounded-xl border border-emerald-700/40">
          <div className="flex items-center space-x-1.5 text-emerald-300 text-xs mb-1 font-medium">
            <PiggyBank className="w-3.5 h-3.5 text-emerald-400" />
            <span className="truncate">{t('totalSaving')}</span>
          </div>
          <div className="text-lg font-extrabold text-white tracking-tight">
            {formatCurrency(summary.totalSaving)}
          </div>
          <div className="text-[10px] text-emerald-300/80 mt-0.5 font-medium">
            Group Deposits
          </div>
        </div>

        {/* 2. Total Loan */}
        <div className="bg-emerald-950/50 backdrop-blur-sm p-3 rounded-xl border border-emerald-700/40">
          <div className="flex items-center space-x-1.5 text-amber-300 text-xs mb-1 font-medium">
            <HandCoins className="w-3.5 h-3.5 text-amber-400" />
            <span className="truncate">{t('totalLoan')}</span>
          </div>
          <div className="text-lg font-extrabold text-white tracking-tight">
            {formatCurrency(summary.totalLoan)}
          </div>
          <div className="text-[10px] text-amber-300/80 mt-0.5 font-medium">
            Active Principal
          </div>
        </div>

        {/* 3. Avl Balance */}
        <div className="bg-emerald-950/50 backdrop-blur-sm p-3 rounded-xl border border-emerald-700/40">
          <div className="flex items-center space-x-1.5 text-cyan-300 text-xs mb-1 font-medium">
            <Wallet className="w-3.5 h-3.5 text-cyan-400" />
            <span className="truncate">{t('avlBalance')}</span>
          </div>
          <div className={`text-lg font-extrabold tracking-tight ${summary.avlBalance >= 0 ? 'text-cyan-300' : 'text-rose-400'}`}>
            {formatCurrency(summary.avlBalance)}
          </div>
          <div className="text-[10px] text-cyan-200/80 mt-0.5 font-medium">
            Cash In-Hand
          </div>
        </div>

        {/* 4. Interest Receivable */}
        <div className="bg-emerald-950/50 backdrop-blur-sm p-3 rounded-xl border border-emerald-700/40">
          <div className="flex items-center space-x-1.5 text-emerald-300 text-xs mb-1 font-medium">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span className="truncate">{t('interestReceivable')}</span>
          </div>
          <div className="text-lg font-extrabold text-emerald-300 tracking-tight">
            {formatCurrency(summary.interestReceivable)}
          </div>
          <div className="text-[10px] text-emerald-300/80 mt-0.5 font-medium">
            Unpaid 2%/mo
          </div>
        </div>
      </div>
    </div>
  );
}
