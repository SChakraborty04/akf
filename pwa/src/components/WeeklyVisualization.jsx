import React from 'react';
import { BarChart3, RotateCcw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/formatters';
import { formatShortDayMonth, formatWeekDateRange } from '../utils/dates';
import LoadingButton from './LoadingButton';

const THEME_MAP = {
  emerald: {
    icon: 'text-emerald-700',
    bar: 'bg-emerald-600',
    barActive: 'bg-emerald-800',
    cardActive: 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-400',
    amountActive: 'text-emerald-800',
    pill: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  amber: {
    icon: 'text-amber-700',
    bar: 'bg-amber-600',
    barActive: 'bg-amber-800',
    cardActive: 'bg-amber-50 border-amber-400 ring-1 ring-amber-400',
    amountActive: 'text-amber-800',
    pill: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  cyan: {
    icon: 'text-cyan-700',
    bar: 'bg-cyan-600',
    barActive: 'bg-cyan-800',
    cardActive: 'bg-cyan-50 border-cyan-400 ring-1 ring-cyan-400',
    amountActive: 'text-cyan-800',
    pill: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  },
};

export default function WeeklyVisualization({
  weeks = [],
  selectedWeekKey = null,
  onSelectWeek,
  theme = 'emerald',
}) {
  const { language, t } = useLanguage();
  const toast = useToast();
  const palette = THEME_MAP[theme] || THEME_MAP.emerald;

  const maxAmount = Math.max(1, ...weeks.map((w) => Number(w.totalAmount || 0)));
  const activeWeek = weeks.find((w) => w.weekKey === selectedWeekKey);

  const handleBarClick = (week) => {
    const rangeLabel = formatWeekDateRange(week.weekStartYMD, week.weekEndYMD, language);
    if (selectedWeekKey === week.weekKey) {
      onSelectWeek(null);
      toast.success(t('allWeeks'));
    } else {
      onSelectWeek(week.weekKey);
      toast.success(`${t('weekLabel')} ${week.weekNumber} (${rangeLabel})`);
    }
  };

  const handleResetWeek = () => {
    if (!selectedWeekKey) {
      toast.error(t('noFilterActive'));
      return;
    }
    onSelectWeek(null);
    toast.success(t('allWeeks'));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-3.5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-1.5 min-w-0">
          <BarChart3 className={`w-4 h-4 shrink-0 ${palette.icon}`} />
          <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider truncate">
            {t('weeklyVisualization')} ({weeks.length})
          </h2>
        </div>

        {selectedWeekKey && (
          <LoadingButton
            minLoaderMs={100}
            onClick={handleResetWeek}
            spinnerClassName="w-3 h-3"
            className="flex items-center space-x-1 text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{t('allWeeks')}</span>
          </LoadingButton>
        )}
      </div>

      {weeks.length === 0 ? (
        <div className="py-5 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          {t('noWeeklyData')}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto pb-1">
            <div className="flex items-end gap-2 min-w-max sm:min-w-full">
              {weeks.map((week) => {
                const isSelected = selectedWeekKey === week.weekKey;
                const heightPct =
                  week.totalAmount > 0
                    ? Math.max(14, Math.round((week.totalAmount / maxAmount) * 100))
                    : 4;

                return (
                  <LoadingButton
                    key={week.weekKey}
                    minLoaderMs={100}
                    iconOnly={false}
                    spinnerClassName="w-3 h-3 text-slate-500"
                    onClick={() => handleBarClick(week)}
                    className={`min-w-[68px] flex-1 max-w-[92px] flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? palette.cardActive
                        : 'bg-slate-50/70 border-slate-200/80 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`text-[10px] font-black truncate max-w-full leading-tight ${
                        isSelected ? palette.amountActive : 'text-slate-800'
                      }`}
                    >
                      {formatCurrency(week.totalAmount)}
                    </span>

                    <div className="w-full h-20 bg-white rounded-lg border border-slate-200/70 p-1 flex items-end justify-center">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full rounded-md transition-all duration-300 ${
                          isSelected ? palette.barActive : palette.bar
                        }`}
                      />
                    </div>

                    <div className="text-center leading-tight w-full">
                      <span className="block text-[10px] font-extrabold text-slate-900 truncate">
                        {t('weekLabel')} {week.weekNumber}
                      </span>
                      <span className="block text-[9px] font-semibold text-slate-500 truncate">
                        {formatShortDayMonth(week.weekStartYMD, language)}
                      </span>
                    </div>
                  </LoadingButton>
                );
              })}
            </div>
          </div>

          {activeWeek && (
            <div
              className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border flex items-center justify-between gap-2 ${palette.pill}`}
            >
              <span className="truncate">
                {t('showingWeek')}: {t('weekLabel')} {activeWeek.weekNumber} (
                {formatWeekDateRange(activeWeek.weekStartYMD, activeWeek.weekEndYMD, language)})
              </span>
              <span className="shrink-0 font-black">
                {formatCurrency(activeWeek.totalAmount)}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

