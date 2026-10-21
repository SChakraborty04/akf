import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  PiggyBank,
  HandCoins,
  RotateCcw,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Users,
  Coins
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useData } from '../context/DataContext';
import { calculateLoanDetails, processRepaymentWaterfall } from '../utils/calculations';
import { formatCurrency } from '../utils/formatters';
import ShapeIcon, { getShapeMeta } from './ShapeIcon';

export default function QuickActionModal({ isOpen, onClose, defaultMode = 'deposit' }) {
  const { t } = useLanguage();
  const {
    groupProfile,
    loanShapes = [],
    members = [],
    loans = [],
    repayments = [],
    addDeposit,
    createLoan,
    addRepayment
  } = useData();

  const stampValue = groupProfile?.stampValue || 50;

  const [mode, setMode] = useState(defaultMode);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  // -------------------------------------------------------------
  // Mode 1: Deposit State (Member stamps table)
  // Map of memberId -> stamps count (0 to 5)
  // -------------------------------------------------------------
  const [memberStamps, setMemberStamps] = useState({});

  // -------------------------------------------------------------
  // Mode 2 & 3: Loan & Repayment Member & Stamps State
  // -------------------------------------------------------------
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState('');
  
  // Array of stamps added: [{ id, shapeId, shape, value }]
  const [addedStamps, setAddedStamps] = useState([]);

  // Reset or initialize state when modal opens or mode changes
  useEffect(() => {
    setMode(defaultMode);
    setDate(new Date().toISOString().split('T')[0]);
    setNote('');
    setAddedStamps([]);

    // Initialize deposit stamps to 0 for all members
    const initialStamps = {};
    members.forEach(m => {
      initialStamps[m.id] = 0;
    });
    setMemberStamps(initialStamps);

    // Default select first member if available
    if (members.length > 0) {
      setSelectedMemberId(members[0].id);
    }
  }, [defaultMode, isOpen, members]);

  // When member changes in repayment mode, auto-select their first active loan
  useEffect(() => {
    if (mode === 'repayment' && selectedMemberId) {
      const memberActiveLoans = loans.filter(
        l => l.memberId === selectedMemberId && l.status === 'Active'
      );
      if (memberActiveLoans.length > 0) {
        setSelectedLoanId(memberActiveLoans[0].id);
      } else {
        setSelectedLoanId('');
      }
    }
  }, [selectedMemberId, loans, mode]);

  if (!isOpen) return null;

  // Selected member object
  const currentMember = members.find(m => m.id === selectedMemberId);

  // Active loans for selected member
  const memberActiveLoans = loans.filter(
    l => l.memberId === selectedMemberId && l.status === 'Active'
  );
  const currentLoan = loans.find(l => l.id === selectedLoanId);
  const currentLoanDetails = currentLoan ? calculateLoanDetails(currentLoan, repayments, date) : null;

  // -------------------------------------------------------------
  // Calculations for Deposit
  // -------------------------------------------------------------
  const totalDepositStamps = Object.values(memberStamps).reduce(
    (sum, val) => sum + Number(val || 0),
    0
  );
  const totalDepositAmount = totalDepositStamps * stampValue;

  const handleMemberStampChange = (memberId, count) => {
    setMemberStamps(prev => ({
      ...prev,
      [memberId]: Math.max(0, Math.min(5, Number(count)))
    }));
  };

  const handleSetAllToOne = () => {
    const updated = {};
    members.forEach(m => {
      updated[m.id] = 1;
    });
    setMemberStamps(updated);
  };

  const handleClearAllStamps = () => {
    const updated = {};
    members.forEach(m => {
      updated[m.id] = 0;
    });
    setMemberStamps(updated);
  };

  // -------------------------------------------------------------
  // Helpers & Calculations for Stamps (Loan & Repayment)
  // -------------------------------------------------------------
  // Get shape definition from seedData
  const getShapeDef = (shapeId) => {
    return loanShapes.find(s => s.id === shapeId) || loanShapes[0] || {
      id: 'circle',
      name: 'Circle',
      value: 1000
    };
  };

  // Calculate row value based on mode: face value for Loan, 2% for Repayment
  const getShapeRowValue = (shapeId, currentMode) => {
    const def = getShapeDef(shapeId);
    if (currentMode === 'repayment') {
      return Math.round(Number(def.value || 0) * 0.02);
    }
    return Number(def.value || 0);
  };

  // Add new stamp row
  const handleAddStampRow = () => {
    const defaultShape = loanShapes[0]?.id || 'circle';
    const stampVal = getShapeRowValue(defaultShape, mode);
    const newStamp = {
      id: 'st-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      shapeId: defaultShape,
      value: stampVal
    };
    setAddedStamps(prev => [...prev, newStamp]);
  };

  // Change shape in a stamp row
  const handleStampShapeChange = (stampId, newShapeId) => {
    const newVal = getShapeRowValue(newShapeId, mode);
    setAddedStamps(prev =>
      prev.map(st => (st.id === stampId ? { ...st, shapeId: newShapeId, value: newVal } : st))
    );
  };

  // Delete stamp row
  const handleDeleteStampRow = (stampId) => {
    setAddedStamps(prev => prev.filter(st => st.id !== stampId));
  };

  // Total value for added stamps
  const totalStampsValue = addedStamps.reduce((sum, st) => sum + Number(st.value || 0), 0);

  // Repayment waterfall preview
  const repaymentWaterfall = (mode === 'repayment' && currentLoan && totalStampsValue > 0)
    ? processRepaymentWaterfall(currentLoan, repayments, totalStampsValue, date)
    : null;

  // -------------------------------------------------------------
  // Form Submission
  // -------------------------------------------------------------
  const handleSubmit = (e) => {
    e.preventDefault();

    if (mode === 'deposit') {
      if (totalDepositAmount <= 0) {
        alert('Please assign at least 1 stamp to one or more members.');
        return;
      }

      const memberDeposits = members.map(m => {
        const stamps = Number(memberStamps[m.id] || 0);
        return {
          memberId: m.id,
          memberName: m.name,
          hhNo: m.hhNo,
          stamps,
          amount: stamps * stampValue
        };
      });

      addDeposit({
        date,
        note: note || 'Meeting Member Savings',
        memberDeposits,
        totalStamps: totalDepositStamps,
        totalAmount: totalDepositAmount
      });
    } else if (mode === 'loan') {
      if (!selectedMemberId) {
        alert('Please select a member.');
        return;
      }
      if (addedStamps.length === 0 || totalStampsValue <= 0) {
        alert('Please add at least one stamp for the loan.');
        return;
      }

      createLoan({
        memberId: selectedMemberId,
        memberName: currentMember?.name || 'Member',
        principalAmount: totalStampsValue,
        date,
        stamps: addedStamps.map(st => ({
          shape: st.shapeId,
          value: st.value
        }))
      });
    } else if (mode === 'repayment') {
      if (!selectedMemberId) {
        alert('Please select a member.');
        return;
      }
      if (!selectedLoanId) {
        alert('Please select an active loan for this member.');
        return;
      }
      if (addedStamps.length === 0 || totalStampsValue <= 0) {
        alert('Please add at least one repayment stamp.');
        return;
      }

      addRepayment({
        loanId: selectedLoanId,
        memberId: selectedMemberId,
        memberName: currentMember?.name || 'Member',
        amountPaid: totalStampsValue,
        date,
        stamps: addedStamps.map(st => ({
          shape: st.shapeId,
          value: st.value
        }))
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-emerald-800 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            {mode === 'deposit' && <PiggyBank className="w-5 h-5 text-emerald-300" />}
            {mode === 'loan' && <HandCoins className="w-5 h-5 text-amber-300" />}
            {mode === 'repayment' && <RotateCcw className="w-5 h-5 text-cyan-300" />}
            <div>
              <h2 className="font-extrabold text-base leading-tight">
                {mode === 'deposit' && t('addDeposit')}
                {mode === 'loan' && t('createLoan')}
                {mode === 'repayment' && t('loanRepayment')}
              </h2>
              <p className="text-[11px] text-emerald-200">
                {mode === 'deposit' && 'Member-level Stamp Deposit Table'}
                {mode === 'loan' && 'Shape-based Loan Issuance'}
                {mode === 'repayment' && 'Shape-based Repayment (2% Values)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-200 hover:text-white p-1 rounded-full hover:bg-emerald-700/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-3 gap-1 p-1.5 bg-slate-100 border-b border-slate-200 text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => {
              setMode('deposit');
              setAddedStamps([]);
            }}
            className={`py-2 rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
              mode === 'deposit'
                ? 'bg-white text-emerald-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PiggyBank className="w-3.5 h-3.5" />
            <span>{t('navDeposits')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('loan');
              setAddedStamps([]);
            }}
            className={`py-2 rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
              mode === 'loan'
                ? 'bg-white text-amber-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HandCoins className="w-3.5 h-3.5" />
            <span>{t('navLoans')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('repayment');
              setAddedStamps([]);
            }}
            className={`py-2 rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
              mode === 'repayment'
                ? 'bg-white text-cyan-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('navRepayments')}</span>
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* ======================================================== */}
          {/* 1. DEPOSIT MODE: Member-Level Stamp Table                */}
          {/* ======================================================== */}
          {mode === 'deposit' && (
            <div className="space-y-3.5">
              {/* Date & Stamp Value Info */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t('date')} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
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
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{t('memberContribution')} ({members.length})</span>
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleSetAllToOne}
                    className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200 transition-colors"
                  >
                    {t('setAllToOne')}
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllStamps}
                    className="text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg border border-slate-200 transition-colors"
                  >
                    {t('clearAllStamps')}
                  </button>
                </div>
              </div>

              {/* Members Stamps Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 text-[11px] font-extrabold text-slate-700">
                      <tr>
                        <th className="py-2 px-3">{t('memberName')}</th>
                        <th className="py-2 px-2 text-center w-28">{t('stamps')} (0-5)</th>
                        <th className="py-2 px-3 text-right w-24">{t('depositAmount')}</th>
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
                            <td className="py-2 px-3">
                              <div className="font-bold text-slate-800 leading-tight">
                                {member.name}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {member.hhNo}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <select
                                value={stamps}
                                onChange={(e) =>
                                  handleMemberStampChange(member.id, e.target.value)
                                }
                                className={`text-xs font-bold rounded-lg px-2 py-1 border transition-all text-center focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
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
                            <td className="py-2 px-3 text-right">
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
                    <Coins className="w-4 h-4 text-emerald-300" />
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
            <div className="space-y-4">
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
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-bold text-slate-800 focus:ring-2 focus:ring-amber-600 focus:outline-none"
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

              {/* Section representing shapes & which shape represents which amount */}
              {selectedMemberId && (
                <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-amber-900 uppercase tracking-wide">
                      {t('shapesLegendTitle')}
                    </span>
                    <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-md">
                      Backend Configurable
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {loanShapes.map((shape) => {
                      const meta = getShapeMeta(shape.symbol || shape.id);
                      return (
                        <div
                          key={shape.id}
                          className="bg-white p-2 rounded-xl border border-amber-200/70 shadow-2xs flex items-center space-x-2"
                        >
                          <div className={`p-1.5 rounded-lg ${meta.bgColor} ${meta.textColor}`}>
                            <ShapeIcon shape={shape.symbol || shape.id} className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-slate-500 block truncate">
                              {shape.name}
                            </span>
                            <span className="text-xs font-black text-slate-900">
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
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                      <Coins className="w-3.5 h-3.5 text-amber-600" />
                      <span>Stamps Selection ({addedStamps.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleAddStampRow}
                      className="bg-amber-700 hover:bg-amber-800 active:scale-95 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 shadow-xs transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('addStampRow')}</span>
                    </button>
                  </div>

                  {/* Stamp Rows List */}
                  {addedStamps.length === 0 ? (
                    <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400">
                      {t('noStampsAdded')}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {addedStamps.map((stamp, index) => {
                        const meta = getShapeMeta(stamp.shapeId);
                        return (
                          <div
                            key={stamp.id}
                            className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-2.5 animate-fadeIn"
                          >
                            <span className="text-[10px] font-black text-slate-400 w-4 text-center">
                              #{index + 1}
                            </span>

                            {/* Shape Icon Preview */}
                            <div className={`p-1.5 rounded-lg ${meta.bgColor} ${meta.textColor}`}>
                              <ShapeIcon shape={stamp.shapeId} className="w-4 h-4" />
                            </div>

                            {/* Shape Dropdown */}
                            <div className="flex-1">
                              <select
                                value={stamp.shapeId}
                                onChange={(e) =>
                                  handleStampShapeChange(stamp.id, e.target.value)
                                }
                                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:ring-2 focus:ring-amber-600 focus:outline-none"
                              >
                                {loanShapes.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name} - {formatCurrency(s.value)}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Shape Value Beside Shape */}
                            <div className="text-right px-1">
                              <span className="text-xs font-black text-amber-800 block">
                                {formatCurrency(stamp.value)}
                              </span>
                            </div>

                            {/* Delete Button at Row End */}
                            <button
                              type="button"
                              onClick={() => handleDeleteStampRow(stamp.id)}
                              className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                              title="Delete Stamp"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Total Value & Date Below Stamps */}
                  <div className="bg-amber-900 text-white p-3.5 rounded-2xl flex items-center justify-between shadow-xs">
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

                  {/* Date Input */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {t('date')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:ring-2 focus:ring-amber-600 focus:outline-none"
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
            <div className="space-y-4">
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
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-bold text-slate-800 focus:ring-2 focus:ring-cyan-600 focus:outline-none"
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
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-cyan-600 focus:outline-none font-bold text-slate-800"
                    >
                      {memberActiveLoans.map((loan) => (
                        <option key={loan.id} value={loan.id}>
                          Loan #{loan.id.slice(-4)} - {formatCurrency(loan.principalAmount)} ({loan.date})
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Loan Details Banner (Unpaid interest & remaining principal) */}
                  {currentLoanDetails && (
                    <div className="mt-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
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

              {/* Shapes Section (2% repayment values) */}
              {selectedMemberId && selectedLoanId && (
                <div className="bg-cyan-50/60 border border-cyan-200/80 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-cyan-900 uppercase tracking-wide">
                      {t('shapesRepaymentLegendTitle')}
                    </span>
                    <span className="text-[10px] text-cyan-800 font-bold bg-cyan-100 px-2 py-0.5 rounded-md">
                      2% Value
                    </span>
                  </div>
                  <p className="text-[10px] text-cyan-700">
                    {t('stampRateNote')}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {loanShapes.map((shape) => {
                      const meta = getShapeMeta(shape.symbol || shape.id);
                      const repVal = Math.round(Number(shape.value || 0) * 0.02);
                      return (
                        <div
                          key={shape.id}
                          className="bg-white p-2 rounded-xl border border-cyan-200/70 shadow-2xs flex items-center space-x-2"
                        >
                          <div className={`p-1.5 rounded-lg ${meta.bgColor} ${meta.textColor}`}>
                            <ShapeIcon shape={shape.symbol || shape.id} className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-slate-500 block truncate">
                              {shape.name}
                            </span>
                            <span className="text-xs font-black text-cyan-800">
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
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                      <Coins className="w-3.5 h-3.5 text-cyan-600" />
                      <span>Repayment Stamps ({addedStamps.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleAddStampRow}
                      className="bg-cyan-700 hover:bg-cyan-800 active:scale-95 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 shadow-xs transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('addStampRow')}</span>
                    </button>
                  </div>

                  {/* Stamp Rows List */}
                  {addedStamps.length === 0 ? (
                    <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400">
                      {t('noStampsAdded')}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {addedStamps.map((stamp, index) => {
                        const meta = getShapeMeta(stamp.shapeId);
                        return (
                          <div
                            key={stamp.id}
                            className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-2.5 animate-fadeIn"
                          >
                            <span className="text-[10px] font-black text-slate-400 w-4 text-center">
                              #{index + 1}
                            </span>

                            {/* Shape Icon Preview */}
                            <div className={`p-1.5 rounded-lg ${meta.bgColor} ${meta.textColor}`}>
                              <ShapeIcon shape={stamp.shapeId} className="w-4 h-4" />
                            </div>

                            {/* Shape Dropdown */}
                            <div className="flex-1">
                              <select
                                value={stamp.shapeId}
                                onChange={(e) =>
                                  handleStampShapeChange(stamp.id, e.target.value)
                                }
                                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:ring-2 focus:ring-cyan-600 focus:outline-none"
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

                            {/* Shape Value Beside Shape (2%) */}
                            <div className="text-right px-1">
                              <span className="text-xs font-black text-cyan-800 block">
                                {formatCurrency(stamp.value)}
                              </span>
                            </div>

                            {/* Delete Button at Row End */}
                            <button
                              type="button"
                              onClick={() => handleDeleteStampRow(stamp.id)}
                              className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                              title="Delete Stamp"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Total Value & Date Below Stamps */}
                  <div className="bg-cyan-900 text-white p-3.5 rounded-2xl flex items-center justify-between shadow-xs">
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

                  {/* Date Input */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {t('date')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:ring-2 focus:ring-cyan-600 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center space-x-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={
                (mode === 'deposit' && totalDepositAmount <= 0) ||
                (mode === 'loan' && (totalStampsValue <= 0 || !selectedMemberId)) ||
                (mode === 'repayment' &&
                  (totalStampsValue <= 0 || !selectedLoanId || memberActiveLoans.length === 0))
              }
              className="flex-1 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors shadow-md flex items-center justify-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t('submit')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
