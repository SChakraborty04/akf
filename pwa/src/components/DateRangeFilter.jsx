import React from 'react';
import { Calendar, RefreshCw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function DateRangeFilter({ startDate, setStartDate, endDate, setEndDate, onClear }) {
  const { t } = useLanguage();

  const isFiltered = Boolean(startDate || endDate);

  return (
    <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-slate-200 mb-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700">
          <Calendar className="w-3.5 h-3.5 text-emerald-700" />
          <span>{t('filterByDate')}</span>
        </div>
        {isFiltered && (
          <button
            onClick={onClear}
            className="flex items-center space-x-1 text-[11px] text-rose-600 hover:text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-md hover:bg-rose-100 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>{t('clearFilter')}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-1">
            {t('startDate')}
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-emerald-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-1">
            {t('endDate')}
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-emerald-600 focus:outline-none"
          />
        </div>
      </div>

      {!isFiltered && (
        <div className="text-[10px] text-slate-400 font-medium text-center pt-0.5">
          {t('showingAll')}
        </div>
      )}
    </div>
  );
}
