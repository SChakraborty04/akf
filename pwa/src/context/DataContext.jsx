import React, { createContext, useContext, useState, useEffect } from 'react';
import { INITIAL_SEED_DATA } from '../constants/seedData';
import { processRepaymentWaterfall } from '../utils/calculations';

const DataContext = createContext();

const LOCAL_STORAGE_KEY = 'lakshi_shg_data';

export function DataProvider({ children }) {
  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure all keys exist
        return {
          groupProfile: parsed.groupProfile || INITIAL_SEED_DATA.groupProfile,
          deposits: parsed.deposits || INITIAL_SEED_DATA.deposits,
          loans: parsed.loans || INITIAL_SEED_DATA.loans,
          repayments: parsed.repayments || INITIAL_SEED_DATA.repayments,
          ledger: parsed.ledger || INITIAL_SEED_DATA.ledger,
          members: parsed.members || INITIAL_SEED_DATA.members
        };
      }
    } catch (e) {
      console.error('Error loading Lakshi SHG data from localStorage:', e);
    }
    return INITIAL_SEED_DATA;
  });

  // Sync to localStorage on any state change
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Error saving Lakshi SHG data to localStorage:', e);
    }
  }, [data]);

  // CRUD Actions

  // 1. Add Group Deposit
  const addDeposit = ({ amount, date, note }) => {
    const depositId = 'dep-' + Date.now();
    const ledgerId = 'led-' + Date.now();
    const depositAmount = Number(amount);
    const depositDate = date || new Date().toISOString().split('T')[0];

    const newDeposit = {
      id: depositId,
      amount: depositAmount,
      date: depositDate,
      note: note || 'Group Deposit'
    };

    const newLedgerEntry = {
      id: ledgerId,
      type: 'Deposit',
      amount: depositAmount,
      date: depositDate,
      description: note || 'Group Monthly Deposit'
    };

    setData(prev => ({
      ...prev,
      deposits: [newDeposit, ...prev.deposits],
      ledger: [newLedgerEntry, ...prev.ledger]
    }));
  };

  // 2. Create Group Loan
  const createLoan = ({ principalAmount, date }) => {
    const loanId = 'loan-' + Date.now();
    const ledgerId = 'led-' + Date.now();
    const loanPrincipal = Number(principalAmount);
    const loanDate = date || new Date().toISOString().split('T')[0];

    const newLoan = {
      id: loanId,
      principalAmount: loanPrincipal,
      date: loanDate,
      monthlyInterestRate: 0.02,
      status: 'Active'
    };

    const newLedgerEntry = {
      id: ledgerId,
      type: 'Loan',
      amount: loanPrincipal,
      date: loanDate,
      description: 'Group Loan Disbursed'
    };

    setData(prev => ({
      ...prev,
      loans: [newLoan, ...prev.loans],
      ledger: [newLedgerEntry, ...prev.ledger]
    }));
  };

  // 3. Add Loan Repayment
  const addRepayment = ({ loanId, amountPaid, date }) => {
    const repaymentDate = date || new Date().toISOString().split('T')[0];
    const targetLoan = data.loans.find(l => l.id === loanId);
    
    if (!targetLoan) return;

    // Process interest & principal deduction waterfall
    const waterfall = processRepaymentWaterfall(targetLoan, data.repayments, amountPaid, repaymentDate);

    const repaymentId = 'rep-' + Date.now();
    const ledgerId = 'led-' + Date.now();

    const newRepayment = {
      id: repaymentId,
      loanId: loanId,
      amountPaid: waterfall.amountPaid,
      interestDeducted: waterfall.interestDeducted,
      principalDeducted: waterfall.principalDeducted,
      date: repaymentDate
    };

    const newLedgerEntry = {
      id: ledgerId,
      type: 'Repayment',
      amount: waterfall.amountPaid,
      date: repaymentDate,
      description: `Loan Repayment (Int: ₹${waterfall.interestDeducted}, Prin: ₹${waterfall.principalDeducted})`
    };

    // Update target loan status if principal reaches zero
    const updatedLoans = data.loans.map(loan => {
      if (loan.id === loanId) {
        return {
          ...loan,
          status: waterfall.willBeFullyPaid ? 'Paid' : 'Active'
        };
      }
      return loan;
    });

    setData(prev => ({
      ...prev,
      loans: updatedLoans,
      repayments: [newRepayment, ...prev.repayments],
      ledger: [newLedgerEntry, ...prev.ledger]
    }));
  };

  // 4. Reset Data to Seed Data
  const resetData = () => {
    setData(INITIAL_SEED_DATA);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_SEED_DATA));
  };

  return (
    <DataContext.Provider
      value={{
        groupProfile: data.groupProfile,
        deposits: data.deposits,
        loans: data.loans,
        repayments: data.repayments,
        ledger: data.ledger,
        members: data.members,
        addDeposit,
        createLoan,
        addRepayment,
        resetData
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
