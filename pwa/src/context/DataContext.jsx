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
        // Ensure all keys exist and migrate if loanShapes missing
        const members = parsed.members || INITIAL_SEED_DATA.members;
        
        // Ensure loans have memberId/memberName
        const loans = (parsed.loans || INITIAL_SEED_DATA.loans).map(l => {
          if (!l.memberId) {
            const fallbackMember = members[0] || { id: 'm1', name: 'Sunita Devi' };
            return { ...l, memberId: fallbackMember.id, memberName: fallbackMember.name };
          }
          return l;
        });

        // Ensure repayments have memberId/memberName
        const repayments = (parsed.repayments || INITIAL_SEED_DATA.repayments).map(r => {
          if (!r.memberId) {
            const associatedLoan = loans.find(l => l.id === r.loanId);
            return {
              ...r,
              memberId: associatedLoan?.memberId || 'm1',
              memberName: associatedLoan?.memberName || 'Sunita Devi'
            };
          }
          return r;
        });

        return {
          groupProfile: parsed.groupProfile || INITIAL_SEED_DATA.groupProfile,
          loanShapes: parsed.loanShapes || INITIAL_SEED_DATA.loanShapes,
          deposits: parsed.deposits || INITIAL_SEED_DATA.deposits,
          loans,
          repayments,
          ledger: parsed.ledger || INITIAL_SEED_DATA.ledger,
          members
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

  // 1. Add Group/Member Deposit
  const addDeposit = ({ date, note, memberDeposits, totalStamps, totalAmount, amount }) => {
    const depositId = 'dep-' + Date.now();
    const depositDate = date || new Date().toISOString().split('T')[0];
    const finalAmount = Number(totalAmount ?? amount ?? 0);
    const finalStamps = Number(totalStamps ?? 0);

    const newDeposit = {
      id: depositId,
      amount: finalAmount,
      totalStamps: finalStamps,
      date: depositDate,
      note: note || 'Meeting Member Savings',
      memberDeposits: memberDeposits || []
    };

    // Maintain member-level ledger entries
    const contributingMembers = (memberDeposits || []).filter(m => Number(m.stamps) > 0);
    let newLedgerEntries = [];

    if (contributingMembers.length > 0) {
      newLedgerEntries = contributingMembers.map((m, idx) => ({
        id: `led-${Date.now()}-${idx}-${m.memberId}`,
        type: 'Deposit',
        amount: Number(m.amount),
        date: depositDate,
        memberId: m.memberId,
        memberName: m.memberName,
        stamps: m.stamps,
        depositId: depositId,
        description: `Deposit - ${m.memberName} (${m.stamps} ${m.stamps === 1 ? 'stamp' : 'stamps'})`
      }));
    } else {
      newLedgerEntries = [{
        id: 'led-' + Date.now(),
        type: 'Deposit',
        amount: finalAmount,
        date: depositDate,
        depositId: depositId,
        description: note || 'Group Monthly Deposit'
      }];
    }

    setData(prev => ({
      ...prev,
      deposits: [newDeposit, ...prev.deposits],
      ledger: [...newLedgerEntries, ...prev.ledger]
    }));
  };

  // 2. Create Member Loan
  const createLoan = ({ memberId, memberName, principalAmount, date, stamps }) => {
    const loanId = 'loan-' + Date.now();
    const ledgerId = 'led-' + Date.now();
    const loanPrincipal = Number(principalAmount);
    const loanDate = date || new Date().toISOString().split('T')[0];

    // Find member name if not passed
    const member = data.members.find(m => m.id === memberId);
    const resolvedMemberName = memberName || member?.name || 'Member';

    const stampsSummary = (stamps || [])
      .map(s => {
        const shapeName = s.shape ? (s.shape.charAt(0).toUpperCase() + s.shape.slice(1)) : 'Stamp';
        return shapeName;
      })
      .join(', ');

    const newLoan = {
      id: loanId,
      memberId,
      memberName: resolvedMemberName,
      principalAmount: loanPrincipal,
      date: loanDate,
      monthlyInterestRate: 0.02,
      status: 'Active',
      stamps: stamps || []
    };

    const newLedgerEntry = {
      id: ledgerId,
      type: 'Loan',
      amount: loanPrincipal,
      date: loanDate,
      memberId,
      memberName: resolvedMemberName,
      loanId: loanId,
      description: `Loan Disbursed - ${resolvedMemberName}${stampsSummary ? ` (${stampsSummary})` : ''}`
    };

    setData(prev => ({
      ...prev,
      loans: [newLoan, ...prev.loans],
      ledger: [newLedgerEntry, ...prev.ledger]
    }));
  };

  // 3. Add Loan Repayment
  const addRepayment = ({ loanId, memberId, memberName, amountPaid, date, stamps }) => {
    const repaymentDate = date || new Date().toISOString().split('T')[0];
    const targetLoan = data.loans.find(l => l.id === loanId);
    
    if (!targetLoan) return;

    // Process interest & principal deduction waterfall
    const waterfall = processRepaymentWaterfall(targetLoan, data.repayments, amountPaid, repaymentDate);

    const repaymentId = 'rep-' + Date.now();
    const ledgerId = 'led-' + Date.now();

    const resolvedMemberId = memberId || targetLoan.memberId;
    const resolvedMember = data.members.find(m => m.id === resolvedMemberId);
    const resolvedMemberName = memberName || targetLoan.memberName || resolvedMember?.name || 'Member';

    const newRepayment = {
      id: repaymentId,
      loanId: loanId,
      memberId: resolvedMemberId,
      memberName: resolvedMemberName,
      amountPaid: waterfall.amountPaid,
      interestDeducted: waterfall.interestDeducted,
      principalDeducted: waterfall.principalDeducted,
      date: repaymentDate,
      stamps: stamps || []
    };

    const newLedgerEntry = {
      id: ledgerId,
      type: 'Repayment',
      amount: waterfall.amountPaid,
      date: repaymentDate,
      memberId: resolvedMemberId,
      memberName: resolvedMemberName,
      loanId: loanId,
      description: `Loan Repayment - ${resolvedMemberName} (Int: ₹${waterfall.interestDeducted}, Prin: ₹${waterfall.principalDeducted})`
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
        loanShapes: data.loanShapes || INITIAL_SEED_DATA.loanShapes,
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
