import React, { useState } from 'react';
import { HandCoins, Plus, Calendar, ChevronDown, ChevronUp, AlertCircle, Clock, User, Coins } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useData } from '../context/DataContext';
import { filterByDateRange, calculateLoanDetails } from '../utils/calculations';
import { formatCurrency, formatDate } from '../utils/formatters';
import DateRangeFilter from '../components/DateRangeFilter';
import QuickActionModal from '../components/QuickActionModal';
import ShapeIcon, { getShapeMeta } from '../components/ShapeIcon';

export default function Loans() {
  const { language, t } = useLanguage();
  const { loans, repayments, members = [] } = useData();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState('');
  const [expandedLoanId, setExpandedLoanId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // 1. Date filter
  const dateFiltered = filterByDateRange(loans, startDate, endDate, 'date');

  // 2. Member filter
  const filteredLoans = selectedMemberFilter
    ? dateFiltered.filter((l) => l.memberId === selectedMemberFilter)
    : dateFiltered;

  const activeLoans = filteredLoans.filter((l) => l.status?.toLowerCase() === 'active');
  const totalActivePrincipal = activeLoans.reduce(
    (sum, l) => sum + Number(l.principalAmount || 0),
    0
  );

  const toggleExpand = (id) => {
    setExpandedLoanId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-4 animate-fadeIn pb-28">
      {/* Header Banner */}
      <div className="bg-amber-800 text-white p-4 rounded-2xl shadow-sm flex items-center justify-between">
        <div>
          <h1 className="font-extrabold text-base">{t('loansTitle')}</h1>
          <p className="text-xs text-amber-200 mt-0.5">{t('interestRate')}: 2% / Month</p>
        </div>
        <div className="bg-amber-700 p-2.5 rounded-xl text-amber-200">
          <HandCoins className="w-6 h-6" />
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

      {/* Member Filter Dropdown */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex items-center space-x-2">
        <User className="w-4 h-4 text-amber-700 shrink-0" />
        <label className="text-xs font-bold text-slate-700 shrink-0">
          {t('memberFilterLabel')}:
        </label>
        <select
          value={selectedMemberFilter}
          onChange={(e) => setSelectedMemberFilter(e.target.value)}
          className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 font-semibold text-slate-800 focus:ring-2 focus:ring-amber-600 focus:outline-none"
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
          <button
            onClick={() => setSelectedMemberFilter('')}
            className="text-[10px] text-slate-400 hover:text-slate-700 font-bold px-1.5 py-1"
          >
            Clear
          </button>
        )}
      </div>

      {members.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-center text-xs text-amber-800 font-medium">
          {t('noMembersWarning')}
        </div>
      )}

      {/* Total Active Principal Metric */}
      <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-xs font-bold text-amber-900 block">{t('totalLoans')}:</span>
          {selectedMemberFilter && (
            <span className="text-[10px] text-amber-700 font-medium block">
              Member: {members.find((m) => m.id === selectedMemberFilter)?.name}
            </span>
          )}
        </div>
        <span className="text-base font-black text-amber-800">
          {formatCurrency(totalActivePrincipal)}
        </span>
      </div>

      {/* Loan List */}
      <div className="space-y-3 pb-24">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {t('loanList')} ({filteredLoans.length})
          </span>
        </div>

        {filteredLoans.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
            {t('noLoans')}
          </div>
        ) : (
          filteredLoans.map((loan) => {
            const details = calculateLoanDetails(loan, repayments);
            const isExpanded = expandedLoanId === loan.id;
            const hasStamps = Array.isArray(loan.stamps) && loan.stamps.length > 0;

            return (
              <div
                key={loan.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all hover:border-amber-300"
              >
                {/* Loan Header Card */}
                <div
                  onClick={() => toggleExpand(loan.id)}
                  className="p-4 cursor-pointer hover:bg-slate-50/70 transition-colors flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-black text-slate-900">
                        {loan.memberName || 'Member Loan'}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          loan.status === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {loan.status === 'Paid' ? t('statusPaid') : t('statusActive')}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 font-medium flex items-center space-x-2">
                      <span className="font-mono text-[11px] text-slate-400">
                        #{loan.id.slice(-4)}
                      </span>
                      <span>•</span>
                      <span>{formatDate(loan.date, language)}</span>
                      <span>•</span>
                      <span>{details.elapsedMonths} mos</span>
                    </div>

                    {/* Shape Stamp Badges */}
                    {hasStamps && (
                      <div className="flex items-center space-x-1.5 pt-0.5">
                        {loan.stamps.map((st, idx) => {
                          const meta = getShapeMeta(st.shape);
                          return (
                            <span
                              key={idx}
                              className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${meta.bgColor} ${meta.borderColor} ${meta.textColor}`}
                              title={`${meta.name}: ${formatCurrency(st.value)}`}
                            >
                              <ShapeIcon shape={st.shape} className="w-3 h-3" />
                              <span>{meta.name}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="text-sm font-black text-slate-900">
                        {formatCurrency(loan.principalAmount)}
                      </div>
                      <div className="text-[11px] font-semibold text-rose-600">
                        Due Int: {formatCurrency(details.unpaidAccruedInterest)}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Collapsible Month-by-Month Interest Breakdown */}
                {isExpanded && (
                  <div className="bg-slate-50 border-t border-slate-200 p-4 space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-700" />
                        <span>{t('monthlyInterestBreakdown')}</span>
                      </div>
                      <span className="text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md text-[10px]">
                        2% / month
                      </span>
                    </div>

                    {/* Breakdown Summary Grid */}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <span className="block text-[10px] text-slate-400 uppercase font-semibold">
                          {t('elapsedMonths')}
                        </span>
                        <span className="font-extrabold text-slate-800">
                          {details.elapsedMonths}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <span className="block text-[10px] text-slate-400 uppercase font-semibold">
                          {t('totalAccruedInterest')}
                        </span>
                        <span className="font-extrabold text-amber-800">
                          {formatCurrency(details.totalAccruedInterest)}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <span className="block text-[10px] text-slate-400 uppercase font-semibold">
                          {t('unpaidInterest')}
                        </span>
                        <span className="font-extrabold text-rose-600">
                          {formatCurrency(details.unpaidAccruedInterest)}
                        </span>
                      </div>
                    </div>

                    {/* Monthly Interest Schedule Table */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase border-b border-slate-200">
                            <th className="py-2 px-3">Month</th>
                            <th className="py-2 px-3 text-right">Accrued (2%)</th>
                            <th className="py-2 px-3 text-right">Cumulative</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {details.monthlyBreakdown.map((row) => (
                            <tr key={row.monthIndex} className="hover:bg-slate-50">
                              <td className="py-2 px-3 text-slate-800 font-semibold">
                                Month {row.monthIndex} ({row.monthName})
                              </td>
                              <td className="py-2 px-3 text-right text-amber-700 font-bold">
                                {formatCurrency(row.monthlyAccrued)}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-900 font-extrabold">
                                {formatCurrency(row.cumulativeAccrued)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Floating Create Loan Button - Fixed directly above bottom nav */}
      <div className="fixed bottom-20 left-0 right-0 max-w-md mx-auto px-4 pointer-events-none z-40 flex justify-end">
        <button
          type="button"
          onClick={() => {
            if (members.length === 0) {
              alert(t('noMembersWarning'));
              return;
            }
            setModalOpen(true);
          }}
          className="pointer-events-auto bg-amber-700 hover:bg-amber-800 active:scale-95 text-white px-4 py-3 rounded-full shadow-2xl flex items-center space-x-2 transition-all border border-amber-500 cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span className="text-xs font-bold pr-1">{t('createLoan')}</span>
        </button>
      </div>

      {/* Quick Action Modal */}
      <QuickActionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultMode="loan"
      />
    </div>
  );
}
