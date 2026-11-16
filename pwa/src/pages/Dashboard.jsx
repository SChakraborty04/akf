import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PiggyBank,
  HandCoins,
  RotateCcw,
  ArrowRight,
  Users,
  MapPin,
  Shield,
  Calendar,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { calculateDashboardSummary } from '../utils/calculations';
import { formatDate } from '../utils/formatters';
import {
  getMeetingDayLabel,
  getLocalTodayYMD,
  getWeekInfoForDate,
  formatWeekDateRange,
} from '../utils/dates';
import SummaryCard from '../components/SummaryCard';
import QuickActionModal from '../components/QuickActionModal';
import LoadingButton from '../components/LoadingButton';

export default function Dashboard() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { deposits, loans, repayments, groupProfile = {}, members = [] } = useData();
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('deposit');

  const summary = calculateDashboardSummary(deposits, loans, repayments);

  const openAction = (mode, label) => {
    if (members.length === 0) {
      toast.error(t('noMembersWarning'));
      return;
    }
    setModalMode(mode);
    setModalOpen(true);
    toast.success(`${label} — ${t('modalOpened')}`);
  };

  const handleViewMembers = () => {
    toast.success(t('groupMembers'));
    navigate('/members');
  };

  const todayYMD = getLocalTodayYMD();
  const currentWeekInfo = groupProfile.cycleStart
    ? getWeekInfoForDate(todayYMD, groupProfile.cycleStart)
    : null;
  const cycleDateRangeText =
    groupProfile.cycleStart && groupProfile.cycleEnd
      ? formatWeekDateRange(groupProfile.cycleStart, groupProfile.cycleEnd, language)
      : null;

  const resolvedAddress =
    groupProfile.address ||
    [groupProfile.panchayat, groupProfile.block, groupProfile.district].filter(Boolean).join(', ') ||
    '--';

  const meetingDayDisplay =
    getMeetingDayLabel(groupProfile.meetingDay, language) || groupProfile.meetingDay || 'Weekly';

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* 4-Quadrant Summary Card */}
      <SummaryCard summary={summary} />

      {/* Alert Banner when SHG has no members */}
      {members.length === 0 && (
        <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-4 flex items-start space-x-3 text-amber-900 shadow-xs">
          <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0 mt-0.5">
            <Users className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-amber-950">{t('noMembersTitle')}</h3>
            <p className="text-xs text-amber-800 leading-relaxed">{t('noMembersDesc')}</p>
          </div>
        </div>
      )}

      {/* 3 Quick Action Buttons */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 px-1">
          {t('quickActions')}
        </h2>
        <div className="grid grid-cols-3 gap-2.5">
          {/* 1. Add Deposit */}
          <LoadingButton
            onClick={() => openAction('deposit', t('addDeposit'))}
            spinnerClassName="w-4 h-4 text-emerald-700"
            className="flex flex-col items-center justify-center p-3 bg-white hover:bg-emerald-50/50 active:scale-95 text-slate-800 rounded-2xl border border-slate-200 shadow-xs transition-all text-center group cursor-pointer gap-1.5"
          >
            <div className="p-2.5 bg-emerald-100/70 text-emerald-700 rounded-xl group-hover:scale-110 transition-transform">
              <PiggyBank className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 leading-tight">
              {t('addDeposit')}
            </span>
          </LoadingButton>

          {/* 2. Create Loan */}
          <LoadingButton
            onClick={() => openAction('loan', t('createLoan'))}
            spinnerClassName="w-4 h-4 text-amber-700"
            className="flex flex-col items-center justify-center p-3 bg-white hover:bg-amber-50/50 active:scale-95 text-slate-800 rounded-2xl border border-slate-200 shadow-xs transition-all text-center group cursor-pointer gap-1.5"
          >
            <div className="p-2.5 bg-amber-100/70 text-amber-700 rounded-xl group-hover:scale-110 transition-transform">
              <HandCoins className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 leading-tight">
              {t('createLoan')}
            </span>
          </LoadingButton>

          {/* 3. Loan Repayment */}
          <LoadingButton
            onClick={() => openAction('repayment', t('loanRepayment'))}
            spinnerClassName="w-4 h-4 text-cyan-700"
            className="flex flex-col items-center justify-center p-3 bg-white hover:bg-cyan-50/50 active:scale-95 text-slate-800 rounded-2xl border border-slate-200 shadow-xs transition-all text-center group cursor-pointer gap-1.5"
          >
            <div className="p-2.5 bg-cyan-100/70 text-cyan-700 rounded-xl group-hover:scale-110 transition-transform">
              <RotateCcw className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 leading-tight">
              {t('loanRepayment')}
            </span>
          </LoadingButton>
        </div>
      </div>

      {/* Group Information Card (Redesigned to match Dashboard visuals) */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-emerald-100/80 text-emerald-700 rounded-lg">
              <Shield className="w-4 h-4" />
            </div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {t('groupDetails')}
            </h2>
          </div>
          <LoadingButton
            minLoaderMs={120}
            onClick={handleViewMembers}
            spinnerClassName="w-3.5 h-3.5 text-emerald-700"
            className="flex items-center space-x-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors cursor-pointer"
          >
            <span>{t('viewMembers')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </LoadingButton>
        </div>

        {/* Group Identity Strip */}
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50/60 to-slate-50 border border-emerald-200/70 rounded-xl p-3 flex items-center space-x-3">
          <div className="bg-white p-1.5 rounded-xl shadow-2xs border border-emerald-200/80 w-11 h-11 flex items-center justify-center shrink-0">
            <img src="/logo-transparent.png" alt="AKF Logo" className="w-7 h-7 object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-sm text-slate-900 tracking-tight truncate">
              {language === 'hi'
                ? groupProfile.hindiName || groupProfile.name
                : groupProfile.name}
            </h3>
            <div className="flex items-center space-x-1 text-[11px] text-slate-600 mt-0.5 font-medium">
              <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
              <span className="truncate">{resolvedAddress}</span>
            </div>
          </div>
        </div>

        {/* Key Group Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/70">
            <span className="block text-[10px] text-emerald-700 uppercase font-bold truncate">
              {t('memberCount')}
            </span>
            <span className="text-sm font-black text-emerald-950 mt-0.5 block">
              {members.length}
            </span>
          </div>

          <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/70">
            <span className="block text-[10px] text-amber-700 uppercase font-bold truncate">
              {t('stampValue')}
            </span>
            <span className="text-sm font-black text-amber-950 mt-0.5 block">
              ₹{groupProfile.stampValue || 50}
            </span>
          </div>

          <div className="bg-cyan-50/70 p-2.5 rounded-xl border border-cyan-200/70">
            <span className="block text-[10px] text-cyan-700 uppercase font-bold truncate">
              {t('cycleNo')}
            </span>
            <span className="text-sm font-black text-cyan-950 mt-0.5 block">
              #{groupProfile.cycleNo || 1}
            </span>
          </div>
        </div>

        {/* Detailed Cycle & Meeting Schedule */}
        <div className="bg-slate-50/80 px-3 py-1 rounded-xl border border-slate-200/80 text-xs divide-y divide-slate-200/70">
          <div className="py-2 flex justify-between items-center gap-2">
            <span className="text-slate-500 font-medium">{t('cycleStart')}:</span>
            <span className="font-bold text-slate-800">
              {groupProfile.cycleStart ? formatDate(groupProfile.cycleStart, language) : '--'}
            </span>
          </div>
          <div className="py-2 flex justify-between items-center gap-2">
            <span className="text-slate-500 font-medium">{t('cycleEnd')}:</span>
            <span className="font-bold text-slate-800">
              {groupProfile.cycleEnd ? formatDate(groupProfile.cycleEnd, language) : '--'}
            </span>
          </div>
          <div className="py-2 flex justify-between items-center gap-2">
            <span className="text-slate-500 font-medium">{t('cycleWeek')}:</span>
            <span className="font-bold text-slate-800 text-right">
              {groupProfile.cycleWeek || 50} weeks
              {cycleDateRangeText && (
                <span className="block text-[10px] font-semibold text-slate-500">
                  ({cycleDateRangeText})
                </span>
              )}
            </span>
          </div>
          {currentWeekInfo && currentWeekInfo.weekNumber >= 1 && (
            <div className="py-2 flex justify-between items-center gap-2">
              <span className="text-slate-500 font-medium">{t('currentWeekLabel')}:</span>
              <span className="font-bold text-emerald-800 text-right">
                {t('weekLabel')} {currentWeekInfo.weekNumber}
                <span className="block text-[10px] font-semibold text-slate-500">
                  ({formatWeekDateRange(currentWeekInfo.weekStartYMD, currentWeekInfo.weekEndYMD, language)})
                </span>
              </span>
            </div>
          )}
          <div className="py-2 flex justify-between items-center gap-2">
            <span className="text-slate-500 font-medium flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-700" />
              <span>{t('meetingDay')}:</span>
            </span>
            <span className="font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[11px]">
              {meetingDayDisplay}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Action Modal */}
      <QuickActionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultMode={modalMode}
      />
    </div>
  );
}
