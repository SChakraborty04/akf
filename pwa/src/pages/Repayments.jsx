import React, { useState } from 'react';
import { RotateCcw, Plus, Calendar, CheckCircle2, ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useData } from '../context/DataContext';
import { filterByDateRange, calculateLoanDetails } from '../utils/calculations';
import { formatCurrency, formatDate } from '../utils/formatters';
import DateRangeFilter from '../components/DateRangeFilter';
import QuickActionModal from '../components/QuickActionModal';

export default function Repayments() {
  const { language, t } = useLanguage();
  const { repayments, loans } = useData();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const filteredRepayments = filterByDateRange(repayments, startDate, endDate, 'date');
  const totalFilteredRepayments = filteredRepayments.reduce((sum, r) => sum + Number(r.amountPaid || 0), 0);

  return (
    <div className="space-y-4 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="bg-cyan-800 text-white p-4 rounded-2xl shadow-sm flex items-center justify-between">
        <div>
          <h1 className="font-extrabold text-base">{t('repaymentsTitle')}</h1>
          <p className="text-xs text-cyan-200 mt-0.5">Waterfall: Interest First, then Principal</p>
        </div>
        <div className="bg-cyan-700 p-2.5 rounded-xl text-cyan-200">
          <RotateCcw className="w-6 h-6" />
        </div>
      </div>

      {/* Date Range Filter */}
      <DateRangeFilter
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        onClear={() => {
          setStartDate('');
          setEndDate('');
        }}
      />

      {/* Total Filtered Metric */}
      <div className="bg-cyan-50 border border-cyan-200 p-3.5 rounded-2xl flex items-center justify-between">
        <span className="text-xs font-bold text-cyan-900">{t('totalRepayments')}:</span>
        <span className="text-base font-black text-cyan-800">{formatCurrency(totalFilteredRepayments)}</span>
      </div>

      {/* Repayments List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {t('repaymentsList')} ({filteredRepayments.length})
          </span>
        </div>

        {filteredRepayments.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
            {t('noRepayments')}
          </div>
        ) : (
          filteredRepayments.map((rep) => {
            const loan = loans.find(l => l.id === rep.loanId);
            const loanDetails = loan ? calculateLoanDetails(loan, repayments) : null;

            return (
              <div
                key={rep.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3 hover:border-cyan-300 transition-colors"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-cyan-100 text-cyan-800 rounded-xl">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        Loan #{rep.loanId?.slice(-4) || 'N/A'} Repayment
                      </div>
                      <div className="flex items-center space-x-1 text-[10px] text-slate-400 font-medium">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{formatDate(rep.date, language)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-black text-cyan-800">
                    +{formatCurrency(rep.amountPaid)}
                  </div>
                </div>

                {/* Repayment Allocation Breakdown Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="block text-[10px] text-slate-400 uppercase font-semibold">
                      {t('interestDeducted')}
                    </span>
                    <span className="font-extrabold text-amber-700">
                      {formatCurrency(rep.interestDeducted)}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="block text-[10px] text-slate-400 uppercase font-semibold">
                      {t('principalDeducted')}
                    </span>
                    <span className="font-extrabold text-emerald-700">
                      {formatCurrency(rep.principalDeducted)}
                    </span>
                  </div>
                </div>

                {/* Remaining Principal Balance Banner */}
                {loanDetails && (
                  <div className="bg-slate-100 p-2.5 rounded-xl flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-600">{t('remainingPrincipal')}:</span>
                    <span className="text-slate-900 font-black">{formatCurrency(loanDetails.remainingPrincipal)}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Floating Repayment Button */}
      <button
        onClick={() => setModalOpen(true)}
        className="fixed bottom-20 right-4 z-40 bg-cyan-700 hover:bg-cyan-800 active:scale-95 text-white p-3.5 rounded-full shadow-2xl flex items-center space-x-2 transition-all border border-cyan-500"
      >
        <Plus className="w-5 h-5" />
        <span className="text-xs font-bold pr-1">{t('loanRepayment')}</span>
      </button>

      {/* Quick Action Modal */}
      <QuickActionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultMode="repayment"
      />
    </div>
  );
}
