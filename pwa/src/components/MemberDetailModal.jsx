import React, { useMemo } from 'react';
import {
  X,
  User,
  Phone,
  MapPin,
  Award,
  Trees,
  Heart,
  Briefcase,
  Users,
  Calendar,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/formatters';
import { getWeekInfoForDate, formatWeekDateRange } from '../utils/dates';
import LoadingButton from './LoadingButton';

export default function MemberDetailModal({ member, onClose }) {
  const { language, t } = useLanguage();
  const { deposits = [], loans = [], repayments = [], groupProfile = {} } = useData();
  const toast = useToast();

  // Compute week-wise member transactions (deposits, loans, repayments)
  const weeklyRows = useMemo(() => {
    if (!member) return [];

    const fallbackDates = [
      ...deposits.map((d) => d.date),
      ...loans.map((l) => l.date),
      ...repayments.map((r) => r.date),
    ];

    const weekMap = new Map();
    const ensureWeek = (dateStr) => {
      const info = getWeekInfoForDate(dateStr, groupProfile?.cycleStart, fallbackDates);
      let row = weekMap.get(info.weekKey);
      if (!row) {
        row = {
          ...info,
          depositAmount: 0,
          depositStamps: 0,
          loanAmount: 0,
          repaymentAmount: 0,
        };
        weekMap.set(info.weekKey, row);
      }
      return row;
    };

    // 1. Deposits for this member
    for (const dep of deposits) {
      if (Array.isArray(dep.memberDeposits)) {
        const md = dep.memberDeposits.find((m) => m.memberId === member.id);
        if (md && (Number(md.amount || 0) > 0 || Number(md.stamps || 0) > 0)) {
          const row = ensureWeek(dep.date);
          row.depositAmount += Number(md.amount || 0);
          row.depositStamps += Number(md.stamps || 0);
        }
      }
    }

    // 2. Loans for this member
    const memberLoansList = loans.filter((l) => l.memberId === member.id);
    const memberLoanIds = new Set(memberLoansList.map((l) => l.id));
    for (const loan of memberLoansList) {
      const row = ensureWeek(loan.date);
      row.loanAmount += Number(loan.principalAmount || 0);
    }

    // 3. Repayments for this member
    for (const rep of repayments) {
      if (rep.memberId === member.id || memberLoanIds.has(rep.loanId)) {
        const row = ensureWeek(rep.date);
        row.repaymentAmount += Number(rep.amountPaid || 0);
      }
    }

    return Array.from(weekMap.values()).sort((a, b) =>
      a.weekStartYMD.localeCompare(b.weekStartYMD)
    );
  }, [member, deposits, loans, repayments, groupProfile?.cycleStart]);

  if (!member) return null;

  const handleClose = () => {
    toast.info(t('modalClosed'));
    onClose();
  };

  // Calculate member-level financials
  const memberTotalDeposits = deposits.reduce((sum, dep) => {
    if (Array.isArray(dep.memberDeposits)) {
      const md = dep.memberDeposits.find((m) => m.memberId === member.id);
      return sum + Number(md?.amount || 0);
    }
    return sum;
  }, 0);

  const memberLoans = loans.filter((l) => l.memberId === member.id);
  const memberActiveLoans = memberLoans.filter((l) => l.status?.toLowerCase() === 'active');
  const memberTotalLoanPrincipal = memberActiveLoans.reduce(
    (sum, l) => sum + Number(l.principalAmount || 0),
    0
  );

  const memberRepayments = repayments.filter(
    (r) => r.memberId === member.id || memberLoans.some((l) => l.id === r.loanId)
  );
  const memberTotalRepayments = memberRepayments.reduce(
    (sum, r) => sum + Number(r.amountPaid || 0),
    0
  );

  const totalWeeklyLoans = weeklyRows.reduce((sum, r) => sum + r.loanAmount, 0);

  const fields = [
    { label: t('hhNo'), value: member.hhNo, icon: MapPin },
    { label: t('memberName'), value: member.name, icon: User },
    { label: t('husbandName'), value: member.husbandName, icon: Heart },
    { label: t('idNo'), value: member.idNo, icon: Award },
    { label: t('age'), value: member.age + ' years', icon: User },
    { label: t('caste'), value: member.caste, icon: Users },
    { label: t('mobileNo'), value: member.mobileNo, icon: Phone },
    { label: t('education'), value: member.education, icon: Award },
    { label: t('agriLand'), value: member.agriLand, icon: Trees },
    { label: t('irrigatedLand'), value: member.irrigatedLand, icon: Trees },
    { label: t('goatCount'), value: member.goatCount, icon: Heart },
    { label: t('animalCount'), value: member.animalCount, icon: Heart },
    { label: t('familySize'), value: member.familySize + ' members', icon: Users },
    { label: t('incomeSource'), value: member.incomeSource, icon: Briefcase },
  ];

  return (
    <div className="fixed inset-x-0 top-[60px] bottom-[65px] z-30 max-w-md mx-auto flex items-center justify-center p-2.5 sm:p-3 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-full max-h-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-emerald-800 text-white px-4 sm:px-5 py-3.5 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="bg-emerald-700/80 p-2 rounded-xl border border-emerald-600 shrink-0">
              <User className="w-5 h-5 text-emerald-200" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-base leading-tight truncate">{member.name}</h2>
              <span className="text-[11px] text-emerald-200 font-mono font-medium block truncate">
                {member.hhNo}
              </span>
            </div>
          </div>
          <LoadingButton
            iconOnly
            onClick={handleClose}
            className="text-emerald-200 hover:text-white p-1.5 rounded-full hover:bg-emerald-700/60 transition-colors shrink-0 flex items-center justify-center cursor-pointer"
            aria-label={t('close')}
          >
            <X className="w-5 h-5" />
          </LoadingButton>
        </div>

        {/* Member Details Scrollable Body */}
        <div className="p-3.5 sm:p-4 overflow-y-auto space-y-4 flex-1 min-h-0">
          {/* Member Financial Activity Summary Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 space-y-2">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
              Member Financial Overview
            </span>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="bg-white p-2 rounded-xl border border-slate-200/60 shadow-2xs">
                <span className="text-[9px] text-slate-400 uppercase font-bold block">
                  {t('balanceLabel')}
                </span>
                <span className="text-xs font-black text-emerald-700">
                  {formatCurrency(memberTotalDeposits)}
                </span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200/60 shadow-2xs">
                <span className="text-[9px] text-slate-400 uppercase font-bold block">
                  Active Loans
                </span>
                <span className="text-xs font-black text-amber-700">
                  {formatCurrency(memberTotalLoanPrincipal)}
                </span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200/60 shadow-2xs">
                <span className="text-[9px] text-slate-400 uppercase font-bold block">Repaid</span>
                <span className="text-xs font-black text-cyan-700">
                  {formatCurrency(memberTotalRepayments)}
                </span>
              </div>
            </div>
          </div>

          {/* Week-wise Transaction Details Table */}
          <div className="space-y-2">
            <div className="flex items-center space-x-1.5 px-0.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">
                {t('weeklyHistoryTitle')} ({weeklyRows.length})
              </span>
            </div>

            {weeklyRows.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center text-xs text-slate-400">
                {t('noMemberTransactions')}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 text-[10px] font-extrabold uppercase border-b border-slate-200">
                      <th className="py-2 px-2.5">{t('weekDateCol')}</th>
                      <th className="py-2 px-2 text-right">{t('depositsCol')}</th>
                      <th className="py-2 px-2 text-right">{t('loansCol')}</th>
                      <th className="py-2 px-2.5 text-right">{t('repaymentsCol')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {weeklyRows.map((row) => (
                      <tr key={row.weekKey} className="hover:bg-slate-50/70">
                        <td className="py-2 px-2.5 align-top">
                          <span className="font-extrabold text-slate-900 block whitespace-nowrap">
                            {t('weekLabel')} {row.weekNumber}
                          </span>
                          <span className="text-[9px] font-medium text-slate-500 block whitespace-nowrap">
                            {formatWeekDateRange(row.weekStartYMD, row.weekEndYMD, language)}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right align-top whitespace-nowrap">
                          {row.depositAmount > 0 ? (
                            <div>
                              <span className="font-black text-emerald-700 block">
                                {formatCurrency(row.depositAmount)}
                              </span>
                              <span className="text-[9px] text-slate-400 font-semibold">
                                {row.depositStamps} st.
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right align-top whitespace-nowrap">
                          {row.loanAmount > 0 ? (
                            <span className="font-black text-amber-700">
                              {formatCurrency(row.loanAmount)}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 text-right align-top whitespace-nowrap">
                          {row.repaymentAmount > 0 ? (
                            <span className="font-black text-cyan-700">
                              {formatCurrency(row.repaymentAmount)}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-900 text-white font-black text-[11px]">
                      <td className="py-2 px-2.5">{t('totalRow')}</td>
                      <td className="py-2 px-2 text-right whitespace-nowrap text-emerald-200">
                        {formatCurrency(memberTotalDeposits)}
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap text-amber-200">
                        {formatCurrency(totalWeeklyLoans)}
                      </td>
                      <td className="py-2 px-2.5 text-right whitespace-nowrap text-cyan-200">
                        {formatCurrency(memberTotalRepayments)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Personal Info List */}
          <div className="space-y-3 divide-y divide-slate-100 pt-1">
            {fields.map((field, idx) => {
              const IconComp = field.icon;
              return (
                <div key={idx} className={`${idx !== 0 ? 'pt-2.5' : ''} flex items-start space-x-3`}>
                  <div className="bg-slate-100 p-1.5 rounded-lg text-slate-500 shrink-0 mt-0.5">
                    <IconComp className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      {field.label}
                    </span>
                    <span className="block text-xs font-bold text-slate-800 mt-0.5 break-words">
                      {field.value}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 shrink-0">
          <LoadingButton
            onClick={handleClose}
            className="w-full py-2.5 text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-xl transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <span>{t('close')}</span>
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}
