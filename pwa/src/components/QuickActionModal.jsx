import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  PiggyBank,
  HandCoins,
  RotateCcw,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Users,
  Coins,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { calculateLoanDetails, processRepaymentWaterfall } from '../utils/calculations';
import { formatCurrency } from '../utils/formatters';
import {
  getLatestAllowedMeetingDate,
  isDateAllowedForMeeting,
  getMeetingDayLabel,
} from '../utils/dates';
import ShapeIcon, { getShapeMeta } from './ShapeIcon';
import MeetingDatePicker from './MeetingDatePicker';
import LoadingButton from './LoadingButton';

export default function QuickActionModal({ isOpen, onClose, defaultMode = 'deposit' }) {
  const { language, t } = useLanguage();
  const toast = useToast();
  const {
    groupProfile,
    loanShapes = [],
    members = [],
    loans = [],
    repayments = [],
    addDeposit,
    createLoan,
    addRepayment,
  } = useData();

  const stampValue = groupProfile?.stampValue || 50;
  const meetingDay = groupProfile?.meetingDay;

  const [mode, setMode] = useState(defaultMode);
  const [date, setDate] = useState(() => getLatestAllowedMeetingDate(meetingDay));
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mode 1: Deposit State (Map of memberId -> stamps count 0..5)
  const [memberStamps, setMemberStamps] = useState({});

  // Mode 2 & 3: Loan & Repayment Member & Stamps State
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [addedStamps, setAddedStamps] = useState([]);
  const wasOpenRef = useRef(false);

  // Reset or initialize state only when modal transitions to open
  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    setMode(defaultMode);
    setDate(getLatestAllowedMeetingDate(meetingDay));
    setNote('');
    setAddedStamps([]);
    setIsSubmitting(false);

    const initialStamps = {};
    members.forEach((m) => {
      initialStamps[m.id] = 0;
    });
    setMemberStamps(initialStamps);

    if (members.length > 0) {
      setSelectedMemberId(members[0].id);
    } else {
      setSelectedMemberId('');
    }
  }, [defaultMode, isOpen, members, meetingDay]);

  // Auto-select first active loan when member changes in repayment mode
  useEffect(() => {
    if (mode === 'repayment' && selectedMemberId) {
      const memberActiveLoans = loans.filter(
        (l) => l.memberId === selectedMemberId && l.status?.toLowerCase() === 'active'
      );
      if (memberActiveLoans.length > 0) {
        setSelectedLoanId(memberActiveLoans[0].id);
      } else {
        setSelectedLoanId('');
      }
    }
  }, [selectedMemberId, loans, mode]);

  if (!isOpen) return null;

  const currentMember = members.find((m) => m.id === selectedMemberId);
  const memberActiveLoans = loans.filter(
    (l) => l.memberId === selectedMemberId && l.status?.toLowerCase() === 'active'
  );
  const currentLoan = loans.find((l) => l.id === selectedLoanId);
  const currentLoanDetails = currentLoan
    ? calculateLoanDetails(currentLoan, repayments, date)
    : null;

  // Deposit calculations
  const totalDepositStamps = Object.values(memberStamps).reduce(
    (sum, val) => sum + Number(val || 0),
    0
  );
  const totalDepositAmount = totalDepositStamps * stampValue;

  const handleMemberStampChange = (memberId, count) => {
    setMemberStamps((prev) => ({
      ...prev,
      [memberId]: Math.max(0, Math.min(5, Number(count))),
    }));
  };

  const handleSetAllToOne = () => {
    if (members.length === 0) {
      toast.error(t('noMembersWarning'));
      return;
    }
    const updated = {};
    members.forEach((m) => {
      updated[m.id] = 1;
    });
    setMemberStamps(updated);
    toast.success(t('allStampsSetOne'));
  };

  const handleClearAllStamps = () => {
    if (totalDepositStamps === 0) {
      toast.error(t('stampsAlreadyZero'));
      return;
    }
    const updated = {};
    members.forEach((m) => {
      updated[m.id] = 0;
    });
    setMemberStamps(updated);
    toast.success(t('allStampsCleared'));
  };

  // Shape helpers
  const getShapeDef = (shapeId) => {
    return (
      loanShapes.find((s) => s.id === shapeId) ||
      loanShapes[0] || {
        id: 'circle',
        name: 'Circle',
        value: 1000,
      }
    );
  };

  const getShapeRowValue = (shapeId, currentMode) => {
    const def = getShapeDef(shapeId);
    if (currentMode === 'repayment') {
      return Math.round(Number(def.value || 0) * 0.02);
    }
    return Number(def.value || 0);
  };

  const handleAddStampRow = () => {
    if (!loanShapes || loanShapes.length === 0) {
      toast.error(t('noShapesAvailable'));
      return;
    }
    const defaultShape = loanShapes[0]?.id || 'circle';
    const stampVal = getShapeRowValue(defaultShape, mode);
    const newStamp = {
      id: 'st-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      shapeId: defaultShape,
      value: stampVal,
    };
    setAddedStamps((prev) => [...prev, newStamp]);
    toast.success(t('stampAdded'));
  };

  const handleStampShapeChange = (stampId, newShapeId) => {
    const newVal = getShapeRowValue(newShapeId, mode);
    setAddedStamps((prev) =>
      prev.map((st) => (st.id === stampId ? { ...st, shapeId: newShapeId, value: newVal } : st))
    );
  };

  const handleDeleteStampRow = (stampId) => {
    setAddedStamps((prev) => prev.filter((st) => st.id !== stampId));
    toast.success(t('stampRemoved'));
  };

  const handleSwitchMode = (nextMode, label) => {
    if (mode === nextMode) {
      toast.info(`${label}`);
      return;
    }
    setMode(nextMode);
    setAddedStamps([]);
    toast.success(`${t('switchedTab')}: ${label}`);
  };

  const handleCancelClose = () => {
    toast.info(t('actionCancelled'));
    onClose();
  };

  const totalStampsValue = addedStamps.reduce((sum, st) => sum + Number(st.value || 0), 0);

  const repaymentWaterfall =
    mode === 'repayment' && currentLoan && totalStampsValue > 0
      ? processRepaymentWaterfall(currentLoan, repayments, totalStampsValue, date)
      : null;

  // Form Submission with complete negative/positive toast validations
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 140));

      // 1. Validate Date (Meeting Day + No Future Dates)
      const dateCheck = isDateAllowedForMeeting(date, meetingDay);
      if (!dateCheck.allowed) {
        if (dateCheck.reason === 'future') {
          toast.error(t('errFutureDate'));
        } else if (dateCheck.reason === 'notMeetingDay') {
          const dayLabel = getMeetingDayLabel(meetingDay, language) || meetingDay;
          toast.error(t('errMeetingDayOnly').replace('{day}', dayLabel));
        } else {
          toast.error(t('errInvalidDate'));
        }
        return;
      }

      // 2. Mode-specific field validations
      if (mode === 'deposit') {
        if (totalDepositAmount <= 0) {
          toast.error(t('errAssignOneStamp'));
          return;
        }
      } else if (mode === 'loan') {
        if (!selectedMemberId) {
          toast.error(t('errSelectMember'));
          return;
        }
        if (addedStamps.length === 0 || totalStampsValue <= 0) {
          toast.error(t('errAddLoanStamp'));
          return;
        }
      } else if (mode === 'repayment') {
        if (!selectedMemberId) {
          toast.error(t('errSelectMember'));
          return;
        }
        if (!selectedLoanId) {
          toast.error(t('errSelectActiveLoan'));
          return;
        }
        if (addedStamps.length === 0 || totalStampsValue <= 0) {
          toast.error(t('errAddRepaymentStamp'));
          return;
        }
      }

      let result;
      if (mode === 'deposit') {
        const memberDeposits = members.map((m) => {
          const stamps = Number(memberStamps[m.id] || 0);
          return {
            memberId: m.id,
            memberName: m.name,
            hhNo: m.hhNo,
            stamps,
            amount: stamps * stampValue,
          };
        });

        result = await addDeposit({
          date,
          note: note || 'Meeting Member Savings',
          memberDeposits,
          totalStamps: totalDepositStamps,
          totalAmount: totalDepositAmount,
        });

        if (result?.success === false) {
          toast.error(result.error || 'Failed to record deposit');
          return;
        }
        toast.success(result?.isOffline ? t('depositSavedOffline') : t('depositSuccess'));
      } else if (mode === 'loan') {
        result = await createLoan({
          memberId: selectedMemberId,
          memberName: currentMember?.name || 'Member',
          principalAmount: totalStampsValue,
          date,
          stamps: addedStamps.map((st) => ({
            shape: st.shapeId,
            value: st.value,
          })),
        });

        if (result?.success === false) {
          toast.error(result.error || 'Failed to disburse loan');
          return;
        }
        toast.success(result?.isOffline ? t('loanSavedOffline') : t('loanSuccess'));
      } else if (mode === 'repayment') {
        result = await addRepayment({
          loanId: selectedLoanId,
          memberId: selectedMemberId,
          memberName: currentMember?.name || 'Member',
          amountPaid: totalStampsValue,
          date,
          stamps: addedStamps.map((st) => ({
            shape: st.shapeId,
            value: st.value,
          })),
        });

        if (result?.success === false) {
          toast.error(result.error || 'Failed to record repayment');
          return;
        }
        toast.success(result?.isOffline ? t('repaymentSavedOffline') : t('repaymentSuccess'));
      }

      onClose();
    } catch (err) {
      toast.error(err?.message || 'Transaction failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-x-0 top-[60px] bottom-[65px] z-30 max-w-md mx-auto flex items-center justify-center p-2 sm:p-3 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-full max-h-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col relative">
        {/* Modal Header */}
        <div className="bg-emerald-800 text-white px-4 sm:px-5 py-3 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center space-x-2 min-w-0">
            {mode === 'deposit' && <PiggyBank className="w-5 h-5 text-emerald-300 shrink-0" />}
            {mode === 'loan' && <HandCoins className="w-5 h-5 text-amber-300 shrink-0" />}
            {mode === 'repayment' && <RotateCcw className="w-5 h-5 text-cyan-300 shrink-0" />}
            <div className="min-w-0">
              <h2 className="font-extrabold text-sm sm:text-base leading-tight truncate">
                {mode === 'deposit' && t('addDeposit')}
                {mode === 'loan' && t('createLoan')}
                {mode === 'repayment' && t('loanRepayment')}
              </h2>
              <p className="text-[10px] sm:text-[11px] text-emerald-200 truncate">
                {mode === 'deposit' && 'Member-level Stamp Deposit Table'}
                {mode === 'loan' && 'Shape-based Loan Issuance'}
                {mode === 'repayment' && 'Shape-based Repayment (2% Values)'}
              </p>
            </div>
          </div>
          <LoadingButton
            iconOnly
            onClick={handleCancelClose}
            className="text-emerald-200 hover:text-white p-1.5 rounded-full hover:bg-emerald-700/60 transition-colors shrink-0 flex items-center justify-center cursor-pointer"
            aria-label={t('close')}
          >
            <X className="w-5 h-5" />
          </LoadingButton>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-3 gap-1 p-1.5 bg-slate-100 border-b border-slate-200 text-xs font-semibold shrink-0">
          <LoadingButton
            type="button"
            minLoaderMs={100}
            onClick={() => handleSwitchMode('deposit', t('navDeposits'))}
            className={`py-2 px-1 rounded-xl transition-all flex items-center justify-center space-x-1 cursor-pointer ${
              mode === 'deposit'
                ? 'bg-white text-emerald-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PiggyBank className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t('navDeposits')}</span>
          </LoadingButton>

          <LoadingButton
            type="button"
            minLoaderMs={100}
            onClick={() => handleSwitchMode('loan', t('navLoans'))}
            className={`py-2 px-1 rounded-xl transition-all flex items-center justify-center space-x-1 cursor-pointer ${
              mode === 'loan'
                ? 'bg-white text-amber-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HandCoins className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t('navLoans')}</span>
          </LoadingButton>

          <LoadingButton
            type="button"
            minLoaderMs={100}
            onClick={() => handleSwitchMode('repayment', t('navRepayments'))}
            className={`py-2 px-1 rounded-xl transition-all flex items-center justify-center space-x-1 cursor-pointer ${
              mode === 'repayment'
                ? 'bg-white text-cyan-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t('navRepayments')}</span>
          </LoadingButton>
        </div>

        {/* Form Container with Scrollable Body + Pinned Footer */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1 min-h-0">
          <div className="p-3.5 sm:p-4 overflow-y-auto space-y-3.5 flex-1 min-h-0">
            {members.length === 0 ? (
              <div className="py-8 px-4 text-center space-y-3">
                <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
                  <Users className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">{t('noMembersTitle')}</h3>
                  <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto leading-relaxed">
                    {t('noMembersDesc')}
                  </p>
                </div>
                <LoadingButton
                  type="button"
                  onClick={handleCancelClose}
                  className="mt-4 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition inline-flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <span>{t('close')}</span>
                </LoadingButton>
              </div>
            ) : (
              <>
                {/* ======================================================== */}
                {/* 1. DEPOSIT MODE: Member-Level Stamp Table                */}
                {/* ======================================================== */}
                {mode === 'deposit' && (
                  <div className="space-y-3.5">
                    {/* Meeting Date & Stamp Value Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="min-w-0">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          {t('date')} <span className="text-rose-500">*</span>
                        </label>
                        <MeetingDatePicker
                          value={date}
                          onChange={setDate}
                          meetingDay={meetingDay}
                          mode="deposit"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          {t('stampValuePerStamp')}
                        </label>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-black text-emerald-800 flex items-center justify-between">
                          <span>1 Stamp =</span>
                          <span>₹{stampValue}</span>
                        </div>
                      </div>
                    </div>

                    {/* Note / Meeting Title */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {t('note')}
                      </label>
                      <input
                        type="text"
                        placeholder={t('depositNotePlaceholder')}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                      />
                    </div>

                    {/* Table Header and Quick Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                        <Users className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>
                          {t('memberContribution')} ({members.length})
                        </span>
                      </span>
                      <div className="flex items-center space-x-1.5">
                        <LoadingButton
                          type="button"
                          minLoaderMs={120}
                          onClick={handleSetAllToOne}
                          spinnerClassName="w-3 h-3"
                          className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200 transition-colors flex items-center space-x-1 cursor-pointer"
                        >
                          <span>{t('setAllToOne')}</span>
                        </LoadingButton>
                        <LoadingButton
                          type="button"
                          minLoaderMs={120}
                          onClick={handleClearAllStamps}
                          spinnerClassName="w-3 h-3"
                          className="text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg border border-slate-200 transition-colors flex items-center space-x-1 cursor-pointer"
                        >
                          <span>{t('clearAllStamps')}</span>
                        </LoadingButton>
                      </div>
                    </div>

                    {/* Members Stamps Table */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                      <div className="max-h-52 overflow-y-auto overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 text-[11px] font-extrabold text-slate-700">
                            <tr>
                              <th className="py-2 px-2.5">{t('memberName')}</th>
                              <th className="py-2 px-1.5 text-center w-24">{t('stamps')}</th>
                              <th className="py-2 px-2.5 text-right w-20">{t('depositAmount')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {members.map((member) => {
                              const stamps = Number(memberStamps[member.id] || 0);
                              const rowAmount = stamps * stampValue;
                              return (
                                <tr
                                  key={member.id}
                                  className={`transition-colors ${
                                    stamps > 0 ? 'bg-emerald-50/40' : 'hover:bg-slate-50'
                                  }`}
                                >
                                  <td className="py-2 px-2.5 min-w-0">
                                    <div className="font-bold text-slate-800 leading-tight truncate max-w-[130px]">
                                      {member.name}
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {member.hhNo}
                                    </span>
                                  </td>
                                  <td className="py-2 px-1.5 text-center">
                                    <select
                                      value={stamps}
                                      onChange={(e) =>
                                        handleMemberStampChange(member.id, e.target.value)
                                      }
                                      className={`text-xs font-bold rounded-lg px-1.5 py-1 border transition-all text-center focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                                        stamps > 0
                                          ? 'bg-emerald-100 border-emerald-400 text-emerald-900 shadow-2xs'
                                          : 'bg-slate-50 border-slate-300 text-slate-600'
                                      }`}
                                    >
                                      {[0, 1, 2, 3, 4, 5].map((num) => (
                                        <option key={num} value={num}>
                                          {num} {num === 1 ? 'stamp' : 'stamps'}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="py-2 px-2.5 text-right whitespace-nowrap">
                                    <span
                                      className={`font-black ${
                                        rowAmount > 0 ? 'text-emerald-700' : 'text-slate-400'
                                      }`}
                                    >
                                      {formatCurrency(rowAmount)}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Final Total Deposit Footer Row */}
                      <div className="bg-emerald-900 text-white p-3 flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2">
                          <Coins className="w-4 h-4 text-emerald-300 shrink-0" />
                          <div>
                            <span className="text-[10px] text-emerald-200 block uppercase font-bold">
                              {t('totalStampsCount')}
                            </span>
                            <span className="font-black text-sm text-white">
                              {totalDepositStamps} Stamps
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-emerald-200 block uppercase font-bold">
                            {t('finalTotalDeposit')}
                          </span>
                          <span className="font-black text-base text-emerald-200">
                            {formatCurrency(totalDepositAmount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ======================================================== */}
                {/* 2. LOAN MODE: Member Dropdown, Shape Section, Stamps Row */}
                {/* ======================================================== */}
                {mode === 'loan' && (
                  <div className="space-y-3.5">
                    {/* Member Dropdown */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1.5">
                        <Users className="w-3.5 h-3.5 text-amber-700" />
                        <span>
                          {t('selectMember')} <span className="text-rose-500">*</span>
                        </span>
                      </label>
                      <select
                        required
                        value={selectedMemberId}
                        onChange={(e) => setSelectedMemberId(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800 focus:ring-2 focus:ring-amber-600 focus:outline-none"
                      >
                        <option value="" disabled>
                          {t('selectMemberPrompt')}
                        </option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.hhNo}) - {m.incomeSource}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Shapes Legend */}
                    {selectedMemberId && (
                      <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-amber-900 uppercase tracking-wide truncate">
                            {t('shapesLegendTitle')}
                          </span>
                          <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-md shrink-0">
                            Backend Configurable
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {loanShapes.map((shape) => {
                            const meta = getShapeMeta(shape.symbol || shape.id);
                            return (
                              <div
                                key={shape.id}
                                className="bg-white p-2 rounded-xl border border-amber-200/70 shadow-2xs flex items-center space-x-2 min-w-0"
                              >
                                <div
                                  className={`p-1.5 rounded-lg shrink-0 ${meta.bgColor} ${meta.textColor}`}
                                >
                                  <ShapeIcon shape={shape.symbol || shape.id} className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[10px] font-bold text-slate-500 block truncate">
                                    {shape.name}
                                  </span>
                                  <span className="text-xs font-black text-slate-900 block truncate">
                                    {formatCurrency(shape.value)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Add Stamp Section */}
                    {selectedMemberId && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5 min-w-0">
                            <Coins className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="truncate">
                              Stamps Selection ({addedStamps.length})
                            </span>
                          </span>
                          <LoadingButton
                            type="button"
                            minLoaderMs={120}
                            onClick={handleAddStampRow}
                            className="bg-amber-700 hover:bg-amber-800 active:scale-95 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 shadow-xs transition-all shrink-0 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{t('addStampRow')}</span>
                          </LoadingButton>
                        </div>

                        {/* Stamp Rows List */}
                        {addedStamps.length === 0 ? (
                          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400">
                            {t('noStampsAdded')}
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-44 overflow-y-auto pr-0.5">
                            {addedStamps.map((stamp, index) => {
                              const meta = getShapeMeta(stamp.shapeId);
                              return (
                                <div
                                  key={stamp.id}
                                  className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-2 animate-fadeIn"
                                >
                                  <span className="text-[10px] font-black text-slate-400 w-4 text-center shrink-0">
                                    #{index + 1}
                                  </span>

                                  <div
                                    className={`p-1.5 rounded-lg shrink-0 ${meta.bgColor} ${meta.textColor}`}
                                  >
                                    <ShapeIcon shape={stamp.shapeId} className="w-4 h-4" />
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <select
                                      value={stamp.shapeId}
                                      onChange={(e) =>
                                        handleStampShapeChange(stamp.id, e.target.value)
                                      }
                                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 font-bold text-slate-800 focus:ring-2 focus:ring-amber-600 focus:outline-none truncate"
                                    >
                                      {loanShapes.map((s) => (
                                        <option key={s.id} value={s.id}>
                                          {s.name} - {formatCurrency(s.value)}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="text-right px-1 shrink-0">
                                    <span className="text-xs font-black text-amber-800 block whitespace-nowrap">
                                      {formatCurrency(stamp.value)}
                                    </span>
                                  </div>

                                  <LoadingButton
                                    type="button"
                                    iconOnly
                                    minLoaderMs={100}
                                    onClick={() => handleDeleteStampRow(stamp.id)}
                                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors shrink-0 flex items-center justify-center cursor-pointer"
                                    title="Delete Stamp"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </LoadingButton>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Total Value */}
                        <div className="bg-amber-900 text-white p-3 rounded-2xl flex items-center justify-between shadow-xs">
                          <div>
                            <span className="text-[10px] text-amber-200 uppercase font-bold block">
                              Total Loan Amount
                            </span>
                            <span className="text-base font-black text-white">
                              {formatCurrency(totalStampsValue)}
                            </span>
                          </div>
                          <div className="text-right text-[11px] text-amber-200 font-medium">
                            <span>{addedStamps.length} Stamps Selected</span>
                          </div>
                        </div>

                        {/* Meeting Date Picker */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            {t('date')} <span className="text-rose-500">*</span>
                          </label>
                          <MeetingDatePicker
                            value={date}
                            onChange={setDate}
                            meetingDay={meetingDay}
                            mode="loan"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ======================================================== */}
                {/* 3. REPAYMENT MODE: Member, Member's Loan, 2% Shape Stamps */}
                {/* ======================================================== */}
                {mode === 'repayment' && (
                  <div className="space-y-3.5">
                    {/* Member Dropdown */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1.5">
                        <Users className="w-3.5 h-3.5 text-cyan-700" />
                        <span>
                          {t('selectMember')} <span className="text-rose-500">*</span>
                        </span>
                      </label>
                      <select
                        required
                        value={selectedMemberId}
                        onChange={(e) => setSelectedMemberId(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800 focus:ring-2 focus:ring-cyan-600 focus:outline-none"
                      >
                        <option value="" disabled>
                          {t('selectMemberPrompt')}
                        </option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.hhNo})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Loan Dropdown for Selected Member */}
                    {selectedMemberId && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1.5">
                          <HandCoins className="w-3.5 h-3.5 text-cyan-700" />
                          <span>
                            {t('selectLoan')} <span className="text-rose-500">*</span>
                          </span>
                        </label>

                        {memberActiveLoans.length === 0 ? (
                          <div className="text-xs text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-center space-x-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>{t('noActiveLoansForMember')}</span>
                          </div>
                        ) : (
                          <select
                            value={selectedLoanId}
                            onChange={(e) => setSelectedLoanId(e.target.value)}
                            className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-cyan-600 focus:outline-none font-bold text-slate-800"
                          >
                            {memberActiveLoans.map((loan) => (
                              <option key={loan.id} value={loan.id}>
                                Loan #{loan.id.slice(-4)} - {formatCurrency(loan.principalAmount)} (
                                {loan.date})
                              </option>
                            ))}
                          </select>
                        )}

                        {currentLoanDetails && (
                          <div className="mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs space-y-1">
                            <div className="flex justify-between">
                              <span className="text-slate-500">{t('unpaidInterest')} (2%/mo):</span>
                              <span className="font-bold text-rose-600">
                                {formatCurrency(currentLoanDetails.unpaidAccruedInterest)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">{t('remainingPrincipal')}:</span>
                              <span className="font-black text-slate-800">
                                {formatCurrency(currentLoanDetails.remainingPrincipal)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Shapes Legend (2% repayment values) */}
                    {selectedMemberId && selectedLoanId && (
                      <div className="bg-cyan-50/60 border border-cyan-200/80 rounded-2xl p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-cyan-900 uppercase tracking-wide truncate">
                            {t('shapesRepaymentLegendTitle')}
                          </span>
                          <span className="text-[10px] text-cyan-800 font-bold bg-cyan-100 px-2 py-0.5 rounded-md shrink-0">
                            2% Value
                          </span>
                        </div>

                        <p className="text-[10px] text-cyan-700">{t('stampRateNote')}</p>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {loanShapes.map((shape) => {
                            const meta = getShapeMeta(shape.symbol || shape.id);
                            const repVal = Math.round(Number(shape.value || 0) * 0.02);
                            return (
                              <div
                                key={shape.id}
                                className="bg-white p-2 rounded-xl border border-cyan-200/70 shadow-2xs flex items-center space-x-2 min-w-0"
                              >
                                <div
                                  className={`p-1.5 rounded-lg shrink-0 ${meta.bgColor} ${meta.textColor}`}
                                >
                                  <ShapeIcon shape={shape.symbol || shape.id} className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[10px] font-bold text-slate-500 block truncate">
                                    {shape.name}
                                  </span>
                                  <span className="text-xs font-black text-cyan-800 block truncate">
                                    {formatCurrency(repVal)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Add Stamp Section for Repayment */}
                    {selectedMemberId && selectedLoanId && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5 min-w-0">
                            <Coins className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                            <span className="truncate">
                              Repayment Stamps ({addedStamps.length})
                            </span>
                          </span>
                          <LoadingButton
                            type="button"
                            minLoaderMs={120}
                            onClick={handleAddStampRow}
                            className="bg-cyan-700 hover:bg-cyan-800 active:scale-95 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 shadow-xs transition-all shrink-0 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{t('addStampRow')}</span>
                          </LoadingButton>
                        </div>

                        {addedStamps.length === 0 ? (
                          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400">
                            {t('noStampsAdded')}
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-44 overflow-y-auto pr-0.5">
                            {addedStamps.map((stamp, index) => {
                              const meta = getShapeMeta(stamp.shapeId);
                              return (
                                <div
                                  key={stamp.id}
                                  className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-2 animate-fadeIn"
                                >
                                  <span className="text-[10px] font-black text-slate-400 w-4 text-center shrink-0">
                                    #{index + 1}
                                  </span>

                                  <div
                                    className={`p-1.5 rounded-lg shrink-0 ${meta.bgColor} ${meta.textColor}`}
                                  >
                                    <ShapeIcon shape={stamp.shapeId} className="w-4 h-4" />
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <select
                                      value={stamp.shapeId}
                                      onChange={(e) =>
                                        handleStampShapeChange(stamp.id, e.target.value)
                                      }
                                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 font-bold text-slate-800 focus:ring-2 focus:ring-cyan-600 focus:outline-none truncate"
                                    >
                                      {loanShapes.map((s) => {
                                        const repVal = Math.round(Number(s.value || 0) * 0.02);
                                        return (
                                          <option key={s.id} value={s.id}>
                                            {s.name} - {formatCurrency(repVal)} (2% of ₹{s.value})
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </div>

                                  <div className="text-right px-1 shrink-0">
                                    <span className="text-xs font-black text-cyan-800 block whitespace-nowrap">
                                      {formatCurrency(stamp.value)}
                                    </span>
                                  </div>

                                  <LoadingButton
                                    type="button"
                                    iconOnly
                                    minLoaderMs={100}
                                    onClick={() => handleDeleteStampRow(stamp.id)}
                                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors shrink-0 flex items-center justify-center cursor-pointer"
                                    title="Delete Stamp"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </LoadingButton>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Total Value */}
                        <div className="bg-cyan-900 text-white p-3 rounded-2xl flex items-center justify-between shadow-xs">
                          <div>
                            <span className="text-[10px] text-cyan-200 uppercase font-bold block">
                              Total Repayment Value
                            </span>
                            <span className="text-base font-black text-white">
                              {formatCurrency(totalStampsValue)}
                            </span>
                          </div>
                          <div className="text-right text-[11px] text-cyan-200 font-medium">
                            <span>{addedStamps.length} Stamps Selected</span>
                          </div>
                        </div>

                        {/* Waterfall Distribution Preview */}
                        {repaymentWaterfall && (
                          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs space-y-1.5">
                            <div className="font-extrabold text-slate-700 flex items-center justify-between">
                              <span>{t('waterfallBreakdown')}</span>
                              {repaymentWaterfall.willBeFullyPaid && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                                  Loan Cleared!
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div className="bg-white p-2 rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-400 block font-semibold">
                                  {t('interestDeducted')}
                                </span>
                                <span className="font-extrabold text-amber-700">
                                  {formatCurrency(repaymentWaterfall.interestDeducted)}
                                </span>
                              </div>
                              <div className="bg-white p-2 rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-400 block font-semibold">
                                  {t('principalDeducted')}
                                </span>
                                <span className="font-extrabold text-emerald-700">
                                  {formatCurrency(repaymentWaterfall.principalDeducted)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Meeting Date Picker */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            {t('date')} <span className="text-rose-500">*</span>
                          </label>
                          <MeetingDatePicker
                            value={date}
                            onChange={setDate}
                            meetingDay={meetingDay}
                            mode="repayment"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Pinned Footer Action Buttons */}
          {members.length > 0 && (
            <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center space-x-2 shrink-0">
              <LoadingButton
                type="button"
                minLoaderMs={100}
                disabled={isSubmitting}
                onClick={handleCancelClose}
                className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-200/80 hover:bg-slate-200 disabled:opacity-50 rounded-xl transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <span>{t('cancel')}</span>
              </LoadingButton>
              <LoadingButton
                type="submit"
                loading={isSubmitting}
                loadingText={t('processing')}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl transition-colors shadow-md flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{t('submit')}</span>
              </LoadingButton>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
