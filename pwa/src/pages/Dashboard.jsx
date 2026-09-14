import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PiggyBank, HandCoins, RotateCcw, ArrowRight, BookOpen, PlusCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useData } from '../context/DataContext';
import { calculateDashboardSummary } from '../utils/calculations';
import { formatCurrency, formatDate } from '../utils/formatters';
import SummaryCard from '../components/SummaryCard';
import QuickActionModal from '../components/QuickActionModal';

export default function Dashboard() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { deposits, loans, repayments, ledger } = useData();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('deposit');

  const summary = calculateDashboardSummary(deposits, loans, repayments);
  const recentLedger = ledger.slice(0, 5);

  const openAction = (mode) => {
    setModalMode(mode);
    setModalOpen(true);
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* 4-Quadrant Summary Card */}
      <SummaryCard summary={summary} />

      {/* 3 Quick Action Buttons */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 px-1">
          {t('quickActions')}
        </h2>
        <div className="grid grid-cols-3 gap-2.5">
          {/* 1. Add Deposit */}
          <button
            onClick={() => openAction('deposit')}
            className="flex flex-col items-center justify-center p-3 bg-white hover:bg-emerald-50/50 active:scale-95 text-slate-800 rounded-2xl border border-slate-200 shadow-xs transition-all text-center group"
          >
            <div className="p-2.5 bg-emerald-100/70 text-emerald-700 rounded-xl mb-1.5 group-hover:scale-110 transition-transform">
              <PiggyBank className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 leading-tight">
              {t('addDeposit')}
            </span>
          </button>

          {/* 2. Create Loan */}
          <button
            onClick={() => openAction('loan')}
            className="flex flex-col items-center justify-center p-3 bg-white hover:bg-amber-50/50 active:scale-95 text-slate-800 rounded-2xl border border-slate-200 shadow-xs transition-all text-center group"
          >
            <div className="p-2.5 bg-amber-100/70 text-amber-700 rounded-xl mb-1.5 group-hover:scale-110 transition-transform">
              <HandCoins className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 leading-tight">
              {t('createLoan')}
            </span>
          </button>

          {/* 3. Loan Repayment */}
          <button
            onClick={() => openAction('repayment')}
            className="flex flex-col items-center justify-center p-3 bg-white hover:bg-cyan-50/50 active:scale-95 text-slate-800 rounded-2xl border border-slate-200 shadow-xs transition-all text-center group"
          >
            <div className="p-2.5 bg-cyan-100/70 text-cyan-700 rounded-xl mb-1.5 group-hover:scale-110 transition-transform">
              <RotateCcw className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 leading-tight">
              {t('loanRepayment')}
            </span>
          </button>
        </div>
      </div>

      {/* Recent Transactions List */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-emerald-700" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {t('recentTransactions')}
            </h2>
          </div>
          <button
            onClick={() => navigate('/ledger')}
            className="flex items-center space-x-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
          >
            <span>{t('viewAll')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentLedger.length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-4">
            {t('noTransactions')}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentLedger.map((item) => {
              const isCredit = item.type === 'Deposit' || item.type === 'Repayment';
              return (
                <div key={item.id} className="py-2.5 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${
                          isCredit ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.type}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {item.description}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      {formatDate(item.date, language)}
                    </div>
                  </div>
                  <div className={`text-xs font-extrabold ${isCredit ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {isCredit ? '+' : '-'}{formatCurrency(item.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Action Modal */}
      <QuickActionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultMode={modalMode}
      />
    </div>
  );
}
