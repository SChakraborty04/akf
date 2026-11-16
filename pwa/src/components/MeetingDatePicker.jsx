import React, { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils/formatters';
import {
  getLocalTodayYMD,
  formatLocalYMD,
  parseYMD,
  parseMeetingWeekday,
  getMeetingDayLabel,
  isDateAllowedForMeeting,
  getLatestAllowedMeetingDate,
} from '../utils/dates';
import LoadingButton from './LoadingButton';

const THEME_CLASSES = {
  deposit: {
    ring: 'focus:ring-emerald-600',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    headerBg: 'bg-emerald-800',
    daySelected: 'bg-emerald-700 text-white shadow-sm font-black',
    dayAvailable: 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-200 font-bold',
    colHighlight: 'text-emerald-700',
    latestBtn: 'bg-emerald-700 hover:bg-emerald-800 text-white',
  },
  loan: {
    ring: 'focus:ring-amber-600',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    headerBg: 'bg-amber-800',
    daySelected: 'bg-amber-700 text-white shadow-sm font-black',
    dayAvailable: 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200 font-bold',
    colHighlight: 'text-amber-700',
    latestBtn: 'bg-amber-700 hover:bg-amber-800 text-white',
  },
  repayment: {
    ring: 'focus:ring-cyan-600',
    badge: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    headerBg: 'bg-cyan-800',
    daySelected: 'bg-cyan-700 text-white shadow-sm font-black',
    dayAvailable: 'bg-cyan-50 text-cyan-900 hover:bg-cyan-100 border border-cyan-200 font-bold',
    colHighlight: 'text-cyan-700',
    latestBtn: 'bg-cyan-700 hover:bg-cyan-800 text-white',
  },
};

const WEEKDAY_HEADERS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEKDAY_HEADERS_HI = ['र', 'सो', 'मं', 'बु', 'गु', 'शु', 'श'];

export default function MeetingDatePicker({
  value,
  onChange,
  meetingDay,
  mode = 'deposit',
}) {
  const { language, t } = useLanguage();
  const toast = useToast();
  const theme = THEME_CLASSES[mode] || THEME_CLASSES.deposit;

  const todayYMD = getLocalTodayYMD();
  const targetWeekday = parseMeetingWeekday(meetingDay);
  const localizedDayName = getMeetingDayLabel(meetingDay, language);

  const [open, setOpen] = useState(false);

  const initialRefDate = useMemo(() => {
    return parseYMD(value) || parseYMD(todayYMD) || new Date();
  }, [value, todayYMD]);

  const [viewYear, setViewYear] = useState(initialRefDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialRefDate.getMonth());

  const openPicker = () => {
    const base = parseYMD(value) || parseYMD(todayYMD) || new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setOpen(true);
    toast.info(t('selectMeetingDate'));
  };

  const todayDate = parseYMD(todayYMD) || new Date();
  const canGoNextMonth =
    viewYear < todayDate.getFullYear() ||
    (viewYear === todayDate.getFullYear() && viewMonth < todayDate.getMonth());

  const handlePrevMonth = () => {
    let nextM = viewMonth - 1;
    let nextY = viewYear;
    if (nextM < 0) {
      nextM = 11;
      nextY -= 1;
    }
    setViewYear(nextY);
    setViewMonth(nextM);
    const label = new Date(nextY, nextM, 1).toLocaleDateString(
      language === 'hi' ? 'hi-IN' : 'en-IN',
      { month: 'short', year: 'numeric' }
    );
    toast.success(label);
  };

  const handleNextMonth = () => {
    if (!canGoNextMonth) {
      toast.error(t('errFutureDate'));
      return;
    }
    let nextM = viewMonth + 1;
    let nextY = viewYear;
    if (nextM > 11) {
      nextM = 0;
      nextY += 1;
    }
    setViewYear(nextY);
    setViewMonth(nextM);
    const label = new Date(nextY, nextM, 1).toLocaleDateString(
      language === 'hi' ? 'hi-IN' : 'en-IN',
      { month: 'short', year: 'numeric' }
    );
    toast.success(label);
  };

  const handleSelectDay = (ymd) => {
    const check = isDateAllowedForMeeting(ymd, meetingDay, todayYMD);
    if (!check.allowed) {
      if (check.reason === 'future') {
        toast.error(t('errFutureDate'));
      } else if (check.reason === 'notMeetingDay') {
        toast.error(
          t('errMeetingDayOnly').replace('{day}', localizedDayName || meetingDay)
        );
      } else {
        toast.error(t('errInvalidDate'));
      }
      return;
    }
    onChange(ymd);
    setOpen(false);
    toast.success(`${t('dateSelected')}: ${formatDate(ymd, language)}`);
  };

  const handleSelectLatest = () => {
    const latest = getLatestAllowedMeetingDate(meetingDay, todayYMD);
    onChange(latest);
    setOpen(false);
    toast.success(`${t('dateSelected')}: ${formatDate(latest, language)}`);
  };

  const handleClose = () => {
    setOpen(false);
    toast.info(t('modalClosed'));
  };

  // Build calendar cells for current viewMonth / viewYear
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const ymd = formatLocalYMD(viewYear, viewMonth, d);
      const check = isDateAllowedForMeeting(ymd, meetingDay, todayYMD);
      cells.push({
        day: d,
        ymd,
        allowed: check.allowed,
        isSelected: ymd === value,
        isToday: ymd === todayYMD,
      });
    }
    return cells;
  }, [viewYear, viewMonth, meetingDay, todayYMD, value]);

  const monthTitle = new Date(viewYear, viewMonth, 1).toLocaleDateString(
    language === 'hi' ? 'hi-IN' : 'en-IN',
    { month: 'long', year: 'numeric' }
  );

  const weekdayHeaders = language === 'hi' ? WEEKDAY_HEADERS_HI : WEEKDAY_HEADERS_EN;
  const constraintLabel = localizedDayName
    ? t('meetingDayOnlyLabel').replace('{day}', localizedDayName)
    : t('anyPastOrTodayLabel');

  return (
    <div className="min-w-0">
      <LoadingButton
        type="button"
        onClick={openPicker}
        className={`w-full text-xs bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-800 flex items-center justify-between gap-2 transition-colors focus:ring-2 focus:outline-none ${theme.ring}`}
      >
        <div className="flex items-center space-x-2 min-w-0">
          <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="truncate font-bold text-slate-900">
            {value ? formatDate(value, language) : t('selectMeetingDate')}
          </span>
        </div>
        {localizedDayName && (
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${theme.badge}`}
          >
            {localizedDayName}
          </span>
        )}
      </LoadingButton>

      <div className="text-[10px] text-slate-500 font-medium mt-1 px-0.5 truncate">
        {constraintLabel}
      </div>

      {/* Modal-within-modal Calendar Overlay (never clipped, never overlaps header/bottom nav) */}
      {open && (
        <div
          className="absolute inset-0 z-30 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-3 animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-label={t('selectMeetingDate')}
        >
          <div className="bg-white rounded-2xl w-full max-w-xs max-h-full overflow-y-auto shadow-2xl border border-slate-200 flex flex-col">
            {/* Calendar Header */}
            <div className={`${theme.headerBg} text-white px-3.5 py-2.5 flex items-center justify-between`}>
              <div className="min-w-0">
                <div className="text-xs font-extrabold leading-tight truncate">
                  {t('selectMeetingDate')}
                </div>
                <div className="text-[10px] text-white/80 truncate">{constraintLabel}</div>
              </div>
              <LoadingButton
                type="button"
                iconOnly
                onClick={handleClose}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/15 transition-colors"
                aria-label={t('close')}
              >
                <X className="w-4 h-4" />
              </LoadingButton>
            </div>

            {/* Month Switcher */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50">
              <LoadingButton
                type="button"
                iconOnly
                minLoaderMs={100}
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </LoadingButton>

              <span className="text-xs font-extrabold text-slate-800">{monthTitle}</span>

              <LoadingButton
                type="button"
                iconOnly
                minLoaderMs={100}
                disabled={!canGoNextMonth}
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </LoadingButton>
            </div>

            {/* Calendar Grid */}
            <div className="p-3">
              <div className="grid grid-cols-7 gap-1 mb-1.5 text-center">
                {weekdayHeaders.map((dayLabel, idx) => (
                  <div
                    key={dayLabel}
                    className={`text-[10px] font-extrabold uppercase py-1 ${
                      targetWeekday === idx ? theme.colHighlight : 'text-slate-400'
                    }`}
                  >
                    {dayLabel}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((cell, idx) => {
                  if (!cell) {
                    return <div key={`empty-${idx}`} className="h-8" />;
                  }

                  if (!cell.allowed) {
                    return (
                      <button
                        key={cell.ymd}
                        type="button"
                        disabled
                        aria-disabled="true"
                        className="h-8 w-full rounded-lg text-[11px] font-medium text-slate-300 bg-slate-50/70 cursor-not-allowed flex items-center justify-center select-none"
                      >
                        {cell.day}
                      </button>
                    );
                  }

                  return (
                    <LoadingButton
                      key={cell.ymd}
                      type="button"
                      iconOnly
                      minLoaderMs={120}
                      spinnerClassName="w-3 h-3"
                      onClick={() => handleSelectDay(cell.ymd)}
                      className={`h-8 w-full rounded-lg text-[11px] transition-all flex items-center justify-center cursor-pointer ${
                        cell.isSelected ? theme.daySelected : theme.dayAvailable
                      } ${cell.isToday && !cell.isSelected ? 'ring-1 ring-offset-1 ring-slate-400' : ''}`}
                    >
                      {cell.day}
                    </LoadingButton>
                  );
                })}
              </div>
            </div>

            {/* Calendar Footer */}
            <div className="px-3 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
              <LoadingButton
                type="button"
                minLoaderMs={120}
                onClick={handleSelectLatest}
                className={`flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center space-x-1 transition-colors cursor-pointer ${theme.latestBtn}`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>{t('latestMeetingBtn')}</span>
              </LoadingButton>
              <LoadingButton
                type="button"
                minLoaderMs={100}
                onClick={handleClose}
                className="py-1.5 px-3 rounded-xl text-[11px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer flex items-center justify-center space-x-1"
              >
                <span>{t('close')}</span>
              </LoadingButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

