import React, { useState, useEffect } from 'react';
import { X, PiggyBank, HandCoins, RotateCcw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useData } from '../context/DataContext';
import { calculateLoanDetails } from '../utils/calculations';
import { formatCurrency } from '../utils/formatters';

export default function QuickActionModal({ isOpen, onClose, defaultMode = 'deposit' }) {
  const { t } = useLanguage();
  const { loans, repayments, addDeposit, createLoan, addRepayment } = useData();

  const [mode, setMode] = useState(defaultMode);

  // Form State
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState('');

  useEffect(() => {
    setMode(defaultMode);
    setDate(new Date().toISOString().split('T')[0]);
    setAmount('');
    setNote('');
    
    // Set default selected loan for repayment
    const activeLoans = loans.filter(l => l.status === 'Active');
    if (activeLoans.length > 0) {
      setSelectedLoanId(activeLoans[0].id);
    }
  }, [defaultMode, isOpen, loans]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    if (mode === 'deposit') {
      if (!amount || Number(amount) <= 0) return;
      addDeposit({ amount: Number(amount), date, note });
    } else if (mode === 'loan') {
      if (!amount || Number(amount) <= 0) return;
      createLoan({ principalAmount: Number(amount), date });
    } else if (mode === 'repayment') {
      if (!selectedLoanId || !amount || Number(amount) <= 0) return;
      addRepayment({ loanId: selectedLoanId, amountPaid: Number(amount), date });
    }

    onClose();
  };

  const activeLoans = loans.filter(l => l.status === 'Active');
  const currentLoan = loans.find(l => l.id === selectedLoanId);
  const currentLoanDetails = currentLoan ? calculateLoanDetails(currentLoan, repayments, date) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all">
        {/* Modal Header */}
        <div className="bg-emerald-800 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {mode === 'deposit' && <PiggyBank className="w-5 h-5 text-emerald-300" />}
            {mode === 'loan' && <HandCoins className="w-5 h-5 text-amber-300" />}
            {mode === 'repayment' && <RotateCcw className="w-5 h-5 text-cyan-300" />}
            <h2 className="font-bold text-base">
              {mode === 'deposit' && t('addDeposit')}
              {mode === 'loan' && t('createLoan')}
              {mode === 'repayment' && t('loanRepayment')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-200 hover:text-white p-1 rounded-full hover:bg-emerald-700/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-3 gap-1 p-2 bg-slate-100 border-b border-slate-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode('deposit')}
            className={`py-2 rounded-xl transition-all ${
              mode === 'deposit' ? 'bg-white text-emerald-800 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('navDeposits')}
          </button>
          <button
            type="button"
            onClick={() => setMode('loan')}
            className={`py-2 rounded-xl transition-all ${
              mode === 'loan' ? 'bg-white text-emerald-800 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('navLoans')}
          </button>
          <button
            type="button"
            onClick={() => setMode('repayment')}
            className={`py-2 rounded-xl transition-all ${
              mode === 'repayment' ? 'bg-white text-emerald-800 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('navRepayments')}
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Select Loan Dropdown for Repayment Mode */}
          {mode === 'repayment' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('selectLoan')}
              </label>
              {activeLoans.length === 0 ? (
                <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  No active loans available for repayment.
                </div>
              ) : (
                <select
                  value={selectedLoanId}
                  onChange={(e) => setSelectedLoanId(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-600 focus:outline-none font-medium"
                >
                  {activeLoans.map(loan => (
                    <option key={loan.id} value={loan.id}>
                      Loan #{loan.id.slice(-4)} - {formatCurrency(loan.principalAmount)} ({loan.date})
                    </option>
                  ))}
                </select>
              )}

              {/* Display Unpaid Interest & Remaining Principal */}
              {currentLoanDetails && (
                <div className="mt-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('unpaidInterest')}:</span>
                    <span className="font-bold text-emerald-700">{formatCurrency(currentLoanDetails.unpaidAccruedInterest)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('remainingPrincipal')}:</span>
                    <span className="font-bold text-slate-800">{formatCurrency(currentLoanDetails.remainingPrincipal)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Amount Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {t('amount')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              step="1"
              required
              placeholder="e.g. 5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            />
          </div>

          {/* Date Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {t('date')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            />
          </div>

          {/* Note Field (for Deposits) */}
          {mode === 'deposit' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('note')}
              </label>
              <input
                type="text"
                placeholder={t('depositNotePlaceholder')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={mode === 'repayment' && activeLoans.length === 0}
              className="flex-1 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl transition-colors shadow-md"
            >
              {t('submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
