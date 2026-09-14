import React, { useState } from 'react';
import { PiggyBank, Plus, Calendar, FileText } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useData } from '../context/DataContext';
import { filterByDateRange } from '../utils/calculations';
import { formatCurrency, formatDate } from '../utils/formatters';
import DateRangeFilter from '../components/DateRangeFilter';
import QuickActionModal from '../components/QuickActionModal';

export default function Deposits() {
  const { language, t } = useLanguage();
  const { deposits } = useData();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const filteredDeposits = filterByDateRange(deposits, startDate, endDate, 'date');
  const totalFilteredDeposits = filteredDeposits.reduce((sum, d) => sum + Number(d.amount || 0), 0);

  return (
    <div className="space-y-4 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="bg-emerald-800 text-white p-4 rounded-2xl shadow-sm flex items-center justify-between">
        <div>
          <h1 className="font-extrabold text-base">{t('depositsTitle')}</h1>
          <p className="text-xs text-emerald-200 mt-0.5">{t('allTimeDeposits')}</p>
        </div>
        <div className="bg-emerald-700 p-2.5 rounded-xl text-emerald-200">
          <PiggyBank className="w-6 h-6" />
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
      <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex items-center justify-between">
        <span className="text-xs font-bold text-emerald-900">{t('totalDeposits')}:</span>
        <span className="text-base font-black text-emerald-800">{formatCurrency(totalFilteredDeposits)}</span>
      </div>

      {/* Deposit Cards List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {t('depositList')} ({filteredDeposits.length})
          </span>
        </div>

        {filteredDeposits.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
            {t('noDeposits')}
          </div>
        ) : (
          filteredDeposits.map((dep) => (
            <div
              key={dep.id}
              className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between hover:border-emerald-300 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-100/70 text-emerald-700 rounded-xl">
                  <PiggyBank className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-800">
                    {dep.note || t('note')}
                  </div>
                  <div className="flex items-center space-x-1 text-[11px] text-slate-400 mt-0.5">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{formatDate(dep.date, language)}</span>
                  </div>
                </div>
              </div>
              <div className="text-sm font-black text-emerald-700">
                +{formatCurrency(dep.amount)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Add Deposit Button */}
      <button
        onClick={() => setModalOpen(true)}
        className="fixed bottom-20 right-4 z-40 bg-emerald-800 hover:bg-emerald-900 active:scale-95 text-white p-3.5 rounded-full shadow-2xl flex items-center space-x-2 transition-all border border-emerald-600"
      >
        <Plus className="w-5 h-5" />
        <span className="text-xs font-bold pr-1">{t('addDeposit')}</span>
      </button>

      {/* Quick Action Modal */}
      <QuickActionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultMode="deposit"
      />
    </div>
  );
}
