import React, { useState } from 'react';
import { BookOpen, Calendar, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useData } from '../context/DataContext';
import { filterByDateRange } from '../utils/calculations';
import { formatCurrency, formatDate } from '../utils/formatters';
import DateRangeFilter from '../components/DateRangeFilter';

export default function Ledger() {
  const { language, t } = useLanguage();
  const { ledger } = useData();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredLedger = filterByDateRange(ledger, startDate, endDate, 'date');

  const totalCredits = filteredLedger
    .filter(i => i.type === 'Deposit' || i.type === 'Repayment')
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

  const totalDebits = filteredLedger
    .filter(i => i.type === 'Loan')
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

  return (
    <div className="space-y-4 animate-fadeIn pb-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm flex items-center justify-between">
        <div>
          <h1 className="font-extrabold text-base">{t('ledgerTitle')}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{t('allMovements')}</p>
        </div>
        <div className="bg-slate-800 p-2.5 rounded-xl text-slate-300">
          <BookOpen className="w-6 h-6" />
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

      {/* Credits vs Debits Summary */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl">
          <span className="block text-[10px] font-bold text-emerald-800 uppercase">{t('credit')}</span>
          <span className="text-sm font-black text-emerald-700">{formatCurrency(totalCredits)}</span>
        </div>
        <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl">
          <span className="block text-[10px] font-bold text-rose-800 uppercase">{t('debit')}</span>
          <span className="text-sm font-black text-rose-600">{formatCurrency(totalDebits)}</span>
        </div>
      </div>

      {/* Ledger Feed */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Transactions ({filteredLedger.length})
          </span>
        </div>

        {filteredLedger.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
            {t('noLedger')}
          </div>
        ) : (
          filteredLedger.map((item) => {
            const isCredit = item.type === 'Deposit' || item.type === 'Repayment';

            return (
              <div
                key={item.id}
                className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start space-x-3">
                  <div
                    className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                      isCredit ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {isCredit ? (
                      <ArrowDownLeft className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${
                          isCredit ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.type}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-800 mt-1">
                      {item.description}
                    </div>
                    <div className="flex items-center space-x-1 text-[10px] text-slate-400 font-medium mt-0.5">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{formatDate(item.date, language)}</span>
                    </div>
                  </div>
                </div>

                <div
                  className={`text-sm font-black tracking-tight ${
                    isCredit ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {isCredit ? '+' : '-'}{formatCurrency(item.amount)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
