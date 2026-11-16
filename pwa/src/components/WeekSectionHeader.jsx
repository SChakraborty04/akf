import React from 'react';
import { Calendar } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency } from '../utils/formatters';
import { formatWeekDateRange } from '../utils/dates';

const THEME_CLASSES = {
  emerald: 'bg-emerald-50/90 border-emerald-200 text-emerald-900',
  amber: 'bg-amber-50/90 border-amber-200 text-amber-900',
  cyan: 'bg-cyan-50/90 border-cyan-200 text-cyan-900',
};

const BADGE_CLASSES = {
  emerald: 'bg-emerald-800 text-white',
  amber: 'bg-amber-700 text-white',
  cyan: 'bg-cyan-800 text-white',
};

export default function WeekSectionHeader({
  weekNumber,
  weekStartYMD,
  weekEndYMD,
  totalAmount,
  count,
  theme = 'emerald',
}) {
  const { language, t } = useLanguage();
  const rangeStr = formatWeekDateRange(weekStartYMD, weekEndYMD, language);

  return (
    <div
      className={`rounded-xl border px-3 py-2 flex items-center justify-between gap-2 ${
        THEME_CLASSES[theme] || THEME_CLASSES.emerald
      }`}
    >
      <div className="flex items-center space-x-2 min-w-0">
        <span
          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg shrink-0 ${
            BADGE_CLASSES[theme] || BADGE_CLASSES.emerald
          }`}
        >
          {t('weekLabel')} {weekNumber}
        </span>
        <div className="flex items-center space-x-1 text-[11px] font-bold truncate">
          <Calendar className="w-3 h-3 opacity-70 shrink-0" />
          <span className="truncate">{rangeStr}</span>
        </div>
      </div>

      <div className="text-right shrink-0">
        <span className="text-xs font-black block leading-tight">
          {formatCurrency(totalAmount)}
        </span>
        <span className="text-[9px] font-semibold opacity-75 block">
          {count} {count === 1 ? t('entryCount') : t('entriesCount')}
        </span>
      </div>
    </div>
  );
}

