import React, { useState, useMemo } from 'react';
import { RotateCcw, Plus, Calendar, User } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useData } from '../context/DataContext';
import { filterByDateRange, calculateLoanDetails } from '../utils/calculations';
import { formatCurrency, formatDate } from '../utils/formatters';
import { groupItemsByWeek } from '../utils/dates';
import DateRangeFilter from '../components/DateRangeFilter';
import QuickActionModal from '../components/QuickActionModal';
import ShapeIcon, { getShapeMeta } from '../components/ShapeIcon';
import LoadingButton from '../components/LoadingButton';
import WeeklyVisualization from '../components/WeeklyVisualization';
import WeekSectionHeader from '../components/WeekSectionHeader';
import { useToast } from '../context/ToastContext';

export default function Repayments() {
  const { language, t } = useLanguage();
  const { deposits = [], repayments, loans, groupProfile = {}, members = [] } = useData();
  const toast = useToast();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState('');
  const [selectedWeekKey, setSelectedWeekKey] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // 1. Date filter
  const dateFiltered = filterByDateRange(repayments, startDate, endDate, 'date');

  // 2. Member filter
  const filteredRepayments = selectedMemberFilter
    ? dateFiltered.filter((r) => {
        if (r.memberId) return r.memberId === selectedMemberFilter;
        const associatedLoan = loans.find((l) => l.id === r.loanId);
        return associatedLoan?.memberId === selectedMemberFilter;
      })
    : dateFiltered;

  // 3. Weekly grouping for chart & list
  const fallbackDates = useMemo(
    () => [
      ...deposits.map((d) => d.date),
      ...loans.map((l) => l.date),
      ...repayments.map((r) => r.date),
    ],
    [deposits, loans, repayments]
  );

  const { chartWeeks, listWeeks } = useMemo(
    () =>
      groupItemsByWeek(filteredRepayments, {
        cycleStart: groupProfile?.cycleStart,
        fallbackDates,
        getDate: (r) => r.date,
        getAmount: (r) => Number(r.amountPaid || 0),
      }),
    [filteredRepayments, groupProfile?.cycleStart, fallbackDates]
  );

  const visibleWeeks = selectedWeekKey
    ? listWeeks.filter((w) => w.weekKey === selectedWeekKey)
    : listWeeks;

  const visibleRepayments = selectedWeekKey
    ? visibleWeeks.flatMap((w) => w.items)
    : filteredRepayments;

  const totalFilteredRepayments = visibleRepayments.reduce(
    (sum, r) => sum + Number(r.amountPaid || 0),
    0
  );

  return (
    <div className="space-y-4 animate-fadeIn pb-28">
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
          setSelectedWeekKey(null);
        }}
      />

      {/* Member Filter Dropdown */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex items-center space-x-2">
        <User className="w-4 h-4 text-cyan-700 shrink-0" />
        <label className="text-xs font-bold text-slate-700 shrink-0">
          {t('memberFilterLabel')}:
        </label>
        <select
          value={selectedMemberFilter}
          onChange={(e) => {
            setSelectedMemberFilter(e.target.value);
            setSelectedWeekKey(null);
          }}
          className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 font-semibold text-slate-800 focus:ring-2 focus:ring-cyan-600 focus:outline-none min-w-0"
        >
          <option value="">
            {members.length === 0 ? t('noMembersPrompt') : `${t('allMembers')} (${members.length})`}
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.hhNo})
            </option>
          ))}
        </select>
        {selectedMemberFilter && (
          <LoadingButton
            minLoaderMs={120}
            onClick={() => {
              setSelectedMemberFilter('');
              setSelectedWeekKey(null);
              toast.success(t('filterCleared'));
            }}
            spinnerClassName="w-3 h-3"
            className="text-[10px] text-slate-400 hover:text-slate-700 font-bold px-1.5 py-1 flex items-center space-x-1 cursor-pointer shrink-0"
          >
            <span>Clear</span>
          </LoadingButton>
        )}
      </div>

      {members.length === 0 && (
        <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-3.5 text-center text-xs text-cyan-800 font-medium">
          {t('noMembersWarning')}
        </div>
      )}

      {/* Total Filtered Metric */}
      <div className="bg-cyan-50 border border-cyan-200 p-3.5 rounded-2xl flex items-center justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <span className="text-xs font-bold text-cyan-900 block">{t('totalRepayments')}:</span>
          {selectedMemberFilter && (
            <span className="text-[10px] text-cyan-700 font-medium block truncate">
              Member: {members.find((m) => m.id === selectedMemberFilter)?.name}
            </span>
          )}
        </div>
        <span className="text-base font-black text-cyan-800 shrink-0">
          {formatCurrency(totalFilteredRepayments)}
        </span>
      </div>

      {/* Weekly Visualization Card */}
      <WeeklyVisualization
        weeks={chartWeeks}
        selectedWeekKey={selectedWeekKey}
        onSelectWeek={setSelectedWeekKey}
        theme="cyan"
      />

      {/* Weekly Repayments List */}
      <div className="space-y-4 pb-24">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {t('repaymentsList')} ({visibleRepayments.length})
          </span>
        </div>

        {visibleWeeks.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
            {t('noRepayments')}
          </div>
        ) : (
          visibleWeeks.map((week) => (
            <div key={week.weekKey} className="space-y-2">
              <WeekSectionHeader
                weekNumber={week.weekNumber}
                weekStartYMD={week.weekStartYMD}
                weekEndYMD={week.weekEndYMD}
                totalAmount={week.totalAmount}
                count={week.count}
                theme="cyan"
              />

              {week.items.map((rep) => {
                const loan = loans.find((l) => l.id === rep.loanId);
                const loanDetails = loan ? calculateLoanDetails(loan, repayments) : null;
                const resolvedMemberName = rep.memberName || loan?.memberName || 'Member';
                const hasStamps = Array.isArray(rep.stamps) && rep.stamps.length > 0;

                return (
                  <div
                    key={rep.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 space-y-3 hover:border-cyan-300 transition-colors"
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="p-2 bg-cyan-100 text-cyan-800 rounded-xl shrink-0">
                          <RotateCcw className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black text-slate-900 truncate">
                            {resolvedMemberName}
                          </div>
                          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-400 font-medium mt-0.5">
                            <span className="font-mono text-slate-500">
                              Loan #{rep.loanId?.slice(-4) || 'N/A'}
                            </span>
                            <span>•</span>
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{formatDate(rep.date, language)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-black text-cyan-800 shrink-0">
                        +{formatCurrency(rep.amountPaid)}
                      </div>
                    </div>

                    {/* 2% Shape Stamp Badges (if present) */}
                    {hasStamps && (
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        {rep.stamps.map((st, idx) => {
                          const meta = getShapeMeta(st.shape);
                          return (
                            <span
                              key={idx}
                              className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${meta.bgColor} ${meta.borderColor} ${meta.textColor}`}
                              title={`${meta.name} (2%): ${formatCurrency(st.value)}`}
                            >
                              <ShapeIcon shape={st.shape} className="w-3 h-3" />
                              <span>
                                {meta.name} ({formatCurrency(st.value)})
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    )}

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
                        <span className="text-slate-900 font-black">
                          {formatCurrency(loanDetails.remainingPrincipal)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Floating Repayment Button - Fixed directly above bottom nav */}
      {!modalOpen && (
        <div className="fixed bottom-20 left-0 right-0 max-w-md mx-auto px-4 pointer-events-none z-20 flex justify-end">
          <LoadingButton
            type="button"
            minLoaderMs={140}
            onClick={() => {
              if (members.length === 0) {
                toast.error(t('noMembersWarning'));
                return;
              }
              setModalOpen(true);
              toast.success(`${t('loanRepayment')} — ${t('modalOpened')}`);
            }}
            className="pointer-events-auto bg-cyan-700 hover:bg-cyan-800 active:scale-95 text-white px-4 py-3 rounded-full shadow-2xl flex items-center space-x-2 transition-all border border-cyan-500 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span className="text-xs font-bold pr-1">{t('loanRepayment')}</span>
          </LoadingButton>
        </div>
      )}

      {/* Quick Action Modal */}
      <QuickActionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultMode="repayment"
      />
    </div>
  );
}
