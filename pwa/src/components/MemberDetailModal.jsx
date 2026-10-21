import React from 'react';
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
  PiggyBank,
  HandCoins,
  RotateCcw
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useData } from '../context/DataContext';
import { formatCurrency } from '../utils/formatters';

export default function MemberDetailModal({ member, onClose }) {
  const { t } = useLanguage();
  const { deposits = [], loans = [], repayments = [] } = useData();

  if (!member) return null;

  // Calculate member-level financials
  const memberTotalDeposits = deposits.reduce((sum, dep) => {
    if (Array.isArray(dep.memberDeposits)) {
      const md = dep.memberDeposits.find((m) => m.memberId === member.id);
      return sum + Number(md?.amount || 0);
    }
    return sum;
  }, 0);

  const memberLoans = loans.filter((l) => l.memberId === member.id);
  const memberActiveLoans = memberLoans.filter((l) => l.status === 'Active');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="bg-emerald-800 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="bg-emerald-700/80 p-2 rounded-xl border border-emerald-600">
              <User className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">{member.name}</h2>
              <span className="text-[11px] text-emerald-200 font-mono font-medium">
                {member.hhNo}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-200 hover:text-white p-1 rounded-full hover:bg-emerald-700/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Member Details Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Member Financial Activity Summary Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 space-y-2">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
              Member Financial Overview
            </span>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="bg-white p-2 rounded-xl border border-slate-200/60 shadow-2xs">
                <span className="text-[9px] text-slate-400 uppercase font-bold block">Savings</span>
                <span className="text-xs font-black text-emerald-700">
                  {formatCurrency(memberTotalDeposits)}
                </span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200/60 shadow-2xs">
                <span className="text-[9px] text-slate-400 uppercase font-bold block">Loans</span>
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

          {/* Personal Info List */}
          <div className="space-y-3 divide-y divide-slate-100">
            {fields.map((field, idx) => {
              const IconComp = field.icon;
              return (
                <div key={idx} className={`${idx !== 0 ? 'pt-2.5' : ''} flex items-start space-x-3`}>
                  <div className="bg-slate-100 p-1.5 rounded-lg text-slate-500 shrink-0 mt-0.5">
                    <IconComp className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1">
                    <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      {field.label}
                    </span>
                    <span className="block text-xs font-bold text-slate-800 mt-0.5">
                      {field.value}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-xl transition-colors"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
