import React, { useState } from 'react';
import { PiggyBank, Plus, Calendar, ChevronDown, ChevronUp, Users, Coins, User } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useData } from '../context/DataContext';
import { filterByDateRange } from '../utils/calculations';
import { formatCurrency, formatDate } from '../utils/formatters';
import DateRangeFilter from '../components/DateRangeFilter';
import QuickActionModal from '../components/QuickActionModal';

export default function Deposits() {
  const { language, t } = useLanguage();
  const { deposits, members = [] } = useData();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState('');
  const [expandedDepositId, setExpandedDepositId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // 1. Date filter
  const dateFiltered = filterByDateRange(deposits, startDate, endDate, 'date');

  // 2. Member filter
  const filteredDeposits = selectedMemberFilter
    ? dateFiltered.filter((dep) => {
        if (!dep.memberDeposits) return true;
        const memDep = dep.memberDeposits.find((m) => m.memberId === selectedMemberFilter);
        return memDep && Number(memDep.stamps) > 0;
      })
    : dateFiltered;

  // Calculate filtered total
  const totalFilteredDeposits = filteredDeposits.reduce((sum, d) => {
    if (selectedMemberFilter && d.memberDeposits) {
      const memDep = d.memberDeposits.find((m) => m.memberId === selectedMemberFilter);
      return sum + Number(memDep?.amount || 0);
    }
    return sum + Number(d.amount || 0);
  }, 0);

  const toggleExpand = (id) => {
    setExpandedDepositId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-4 animate-fadeIn pb-14">
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

      {/* Member Filter Dropdown */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex items-center space-x-2">
        <User className="w-4 h-4 text-emerald-700 shrink-0" />
        <label className="text-xs font-bold text-slate-700 shrink-0">
          {t('memberFilterLabel')}:
        </label>
        <select
          value={selectedMemberFilter}
          onChange={(e) => setSelectedMemberFilter(e.target.value)}
          className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
        >
          <option value="">{t('allMembers')} ({members.length})</option>
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

      {/* Total Filtered Metric */}
      <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-xs font-bold text-emerald-900 block">
            {t('totalDeposits')}:
          </span>
          {selectedMemberFilter && (
            <span className="text-[10px] text-emerald-700 font-medium block">
              Filtered for: {members.find((m) => m.id === selectedMemberFilter)?.name}
            </span>
          )}
        </div>
        <span className="text-base font-black text-emerald-800">
          {formatCurrency(totalFilteredDeposits)}
        </span>
      </div>

      {/* Deposit Cards List */}
      <div className="space-y-2.5 pb-24">
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
          filteredDeposits.map((dep) => {
            const hasMemberBreakdown =
              Array.isArray(dep.memberDeposits) && dep.memberDeposits.length > 0;
            const isExpanded = expandedDepositId === dep.id;

            // If filtered by member, get specific contribution
            const specificMemberDep = selectedMemberFilter
              ? dep.memberDeposits?.find((m) => m.memberId === selectedMemberFilter)
              : null;

            return (
              <div
                key={dep.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all hover:border-emerald-300"
              >
                {/* Main Card Header */}
                <div
                  onClick={() => hasMemberBreakdown && toggleExpand(dep.id)}
                  className={`p-3.5 flex items-center justify-between ${
                    hasMemberBreakdown ? 'cursor-pointer hover:bg-slate-50/70' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-emerald-100/70 text-emerald-700 rounded-xl">
                      <PiggyBank className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-slate-800 flex items-center space-x-2">
                        <span>{dep.note || t('note')}</span>
                        {dep.totalStamps ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.2 rounded-md flex items-center space-x-1">
                            <Coins className="w-2.5 h-2.5 text-emerald-600" />
                            <span>{dep.totalStamps} stamps</span>
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{formatDate(dep.date, language)}</span>
                        </div>
                        {hasMemberBreakdown && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-700 font-semibold flex items-center space-x-1">
                              <Users className="w-3 h-3" />
                              <span>{dep.memberDeposits.length} members</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="text-right">
                      <div className="text-sm font-black text-emerald-700">
                        +
                        {formatCurrency(
                          specificMemberDep ? specificMemberDep.amount : dep.amount
                        )}
                      </div>
                      {specificMemberDep && (
                        <div className="text-[10px] text-slate-400">
                          {specificMemberDep.stamps} stamps
                        </div>
                      )}
                    </div>
                    {hasMemberBreakdown && (
                      <div className="text-slate-400">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Collapsible Member Breakdown Table */}
                {isExpanded && hasMemberBreakdown && (
                  <div className="bg-slate-50 border-t border-slate-200 p-3.5 space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 px-1">
                      <span className="uppercase tracking-wider">
                        {t('memberContribution')}
                      </span>
                      <span className="text-emerald-700">
                        Total: {formatCurrency(dep.amount)}
                      </span>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase border-b border-slate-200">
                            <th className="py-2 px-3">Member</th>
                            <th className="py-2 px-2 text-center">Stamps</th>
                            <th className="py-2 px-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {dep.memberDeposits.map((md) => (
                            <tr
                              key={md.memberId}
                              className={`hover:bg-slate-50 ${
                                selectedMemberFilter === md.memberId
                                  ? 'bg-emerald-50/70 font-bold'
                                  : ''
                              }`}
                            >
                              <td className="py-1.5 px-3 text-slate-800">
                                <span className="font-semibold">{md.memberName}</span>
                              </td>
                              <td className="py-1.5 px-2 text-center text-slate-600">
                                <span className="inline-block bg-slate-100 px-2 py-0.5 rounded text-[11px] font-bold">
                                  {md.stamps}
                                </span>
                              </td>
                              <td className="py-1.5 px-3 text-right text-emerald-700 font-bold">
                                {formatCurrency(md.amount)}
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

      {/* Floating Add Deposit Button */}
      <div className="fixed bottom-20 left-0 right-0 max-w-md mx-auto px-4 pointer-events-none z-50 flex justify-end">
        <button
          onClick={() => setModalOpen(true)}
          className="pointer-events-auto bg-emerald-800 hover:bg-emerald-900 active:scale-95 text-white px-4 py-3 rounded-full shadow-2xl flex items-center space-x-2 transition-all border border-emerald-600 cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span className="text-xs font-bold pr-1">{t('addDeposit')}</span>
        </button>
      </div>

      {/* Quick Action Modal */}
      <QuickActionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultMode="deposit"
      />
    </div>
  );
}
