import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { processRepaymentWaterfall } from '../utils/calculations';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

const DataContext = createContext();

const LOCAL_STORAGE_KEY = 'lakshi_shg_data';

const isUUID = (str) =>
  typeof str === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

export const DEFAULT_LOAN_SHAPES = [
  { id: 'pentagon', code: 'pentagon', name: 'Pentagon', symbol: 'pentagon', value: 500, color: '#0d9488' },
  { id: 'circle', code: 'circle', name: 'Circle', symbol: 'circle', value: 1000, color: '#2563eb' },
  { id: 'triangle', code: 'triangle', name: 'Triangle', symbol: 'triangle', value: 3000, color: '#d97706' },
  { id: 'star', code: 'star', name: 'Star', symbol: 'star', value: 5000, color: '#7c3aed' },
  { id: 'sun', code: 'sun', name: 'Sun', symbol: 'sun', value: 10000, color: '#ea580c' },
];

export const EMPTY_GROUP_DATA = {
  groupProfile: {
    id: '',
    name: 'SHG Group',
    hindiName: 'स्वयं सहायता समूह',
    district: '',
    block: '',
    panchayat: '',
    formationDate: '',
    memberCount: 0,
    stampValue: 50,
    cycleNo: 1,
    meetingDay: 'Weekly',
  },
  loanShapes: DEFAULT_LOAN_SHAPES,
  deposits: [],
  loans: [],
  repayments: [],
  ledger: [],
  members: [],
};

export function DataProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);

  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);

        // Discard any stale legacy mock seed data (e.g. member IDs 'm1', 'm2' or old 'Lakshi Group' mock)
        const hasLegacySeed =
          (parsed.members || []).some(
            (m) => typeof m.id === 'string' && m.id.startsWith('m') && !m.id.includes('-')
          ) || parsed.groupProfile?.name === 'Lakshi Group';

        if (hasLegacySeed) {
          localStorage.removeItem(LOCAL_STORAGE_KEY);
          return EMPTY_GROUP_DATA;
        }

        const members = Array.isArray(parsed.members) ? parsed.members : [];

        const loans = (parsed.loans || []).map((l) => ({
          ...l,
          status: l.status?.toLowerCase() === 'paid' ? 'Paid' : 'Active',
        }));

        const repayments = Array.isArray(parsed.repayments) ? parsed.repayments : [];
        const deposits = Array.isArray(parsed.deposits) ? parsed.deposits : [];
        const ledger = (parsed.ledger || []).map((item) => ({
          ...item,
          type: item.type
            ? item.type.charAt(0).toUpperCase() + item.type.slice(1).toLowerCase()
            : 'Deposit',
        }));

        return {
          groupProfile: parsed.groupProfile || EMPTY_GROUP_DATA.groupProfile,
          loanShapes: parsed.loanShapes || DEFAULT_LOAN_SHAPES,
          deposits,
          loans,
          repayments,
          ledger,
          members,
        };
      }
    } catch (e) {
      console.error('Error loading SHG data from localStorage:', e);
    }
    return EMPTY_GROUP_DATA;
  });

  // Sync to localStorage on state changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Error saving Lakshi SHG data to localStorage:', e);
    }
  }, [data]);

  // Synchronize authoritative state from API
  const syncSnapshot = useCallback(async () => {
    if (!api.getToken()) return;

    setIsSyncing(true);
    try {
      const snapshot = await api.getSnapshot();
      if (!snapshot) return;

      const normalizedMembers = snapshot.members || [];

      const normalizedShapes = (snapshot.loanShapes || []).map((s) => ({
        id: s.code || s.id,
        code: s.code || s.id,
        name: s.name,
        symbol: s.symbol || s.code || s.id,
        value: Number(s.value),
        color: s.color || '#0d9488',
        repaymentValue: s.repaymentValue,
      }));

      const normalizedLoans = (snapshot.loans || []).map((l) => ({
        ...l,
        status: l.status?.toLowerCase() === 'paid' ? 'Paid' : 'Active',
        principalAmount: Number(l.principalAmount),
      }));

      const normalizedDeposits = (snapshot.deposits || []).map((d) => ({
        ...d,
        amount: Number(d.amount ?? d.totalAmount ?? 0),
        totalStamps: Number(d.totalStamps ?? 0),
      }));

      const normalizedRepayments = (snapshot.repayments || []).map((r) => ({
        ...r,
        amountPaid: Number(r.amountPaid ?? 0),
        interestDeducted: Number(r.interestDeducted ?? 0),
        principalDeducted: Number(r.principalDeducted ?? 0),
      }));

      const normalizedLedger = (snapshot.ledger || []).map((item) => ({
        ...item,
        amount: Number(item.amount ?? 0),
        type: item.type
          ? item.type.charAt(0).toUpperCase() + item.type.slice(1).toLowerCase()
          : 'Deposit',
      }));

      const freshData = {
        groupProfile: snapshot.groupProfile || data.groupProfile,
        loanShapes: normalizedShapes.length > 0 ? normalizedShapes : data.loanShapes,
        members: normalizedMembers, // Strictly authoritative: 0 members on server means 0 members in PWA
        deposits: normalizedDeposits,
        loans: normalizedLoans,
        repayments: normalizedRepayments,
        ledger: normalizedLedger,
      };

      setData(freshData);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(freshData));
    } catch (err) {
      console.warn('[PWA Data] Server sync skipped or offline, using cached store:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [data.groupProfile, data.loanShapes]);

  // Sync snapshot when operator is authenticated
  useEffect(() => {
    if (isAuthenticated && api.getToken()) {
      syncSnapshot();
    }
  }, [isAuthenticated, user?.id]);

  // -------------------------------------------------------------
  // CRUD Actions (End-to-End API Connected with Offline Fallback)
  // -------------------------------------------------------------

  // 1. Add Group/Member Deposit
  const addDeposit = async ({ date, note, memberDeposits, totalStamps, totalAmount, amount }) => {
    const depositDate = date || new Date().toISOString().split('T')[0];
    const finalAmount = Number(totalAmount ?? amount ?? 0);
    const finalStamps = Number(totalStamps ?? 0);
    const depositNote = note || 'Meeting Member Savings';
    const contributingMembers = (memberDeposits || []).filter((m) => Number(m.stamps) > 0);

    // Check if we can submit to remote API
    const canUseApi =
      api.getToken() &&
      contributingMembers.length > 0 &&
      contributingMembers.every((m) => isUUID(m.memberId));

    if (canUseApi) {
      try {
        const payload = {
          date: depositDate,
          note: depositNote,
          items: contributingMembers.map((m) => ({
            memberId: m.memberId,
            stamps: Number(m.stamps),
          })),
        };

        const res = await api.createDeposit(payload);
        if (res) {
          // Re-sync snapshot to pull authoritative server IDs and ledger
          await syncSnapshot();
          return res;
        }
      } catch (err) {
        console.warn('[PWA Data] Remote deposit failed, executing offline fallback:', err);
      }
    }

    // Local Optimistic Fallback (if offline or non-UUID seed data)
    const depositId = 'dep-' + Date.now();
    const newDeposit = {
      id: depositId,
      amount: finalAmount,
      totalStamps: finalStamps,
      date: depositDate,
      approvalStatus: 'approved',
      note: depositNote,
      memberDeposits: memberDeposits || [],
    };

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
        description: `Deposit - ${m.memberName} (${m.stamps} ${m.stamps === 1 ? 'stamp' : 'stamps'})`,
      }));
    } else {
      newLedgerEntries = [
        {
          id: 'led-' + Date.now(),
          type: 'Deposit',
          amount: finalAmount,
          date: depositDate,
          depositId: depositId,
          description: depositNote,
        },
      ];
    }

    setData((prev) => ({
      ...prev,
      deposits: [newDeposit, ...prev.deposits],
      ledger: [...newLedgerEntries, ...prev.ledger],
    }));

    return newDeposit;
  };

  // 2. Create Member Loan
  const createLoan = async ({ memberId, memberName, principalAmount, date, stamps }) => {
    const loanDate = date || new Date().toISOString().split('T')[0];
    const loanPrincipal = Number(principalAmount);
    const member = data.members.find((m) => m.id === memberId);
    const resolvedMemberName = memberName || member?.name || 'Member';

    const canUseApi = api.getToken() && isUUID(memberId) && (stamps || []).length > 0;

    if (canUseApi) {
      try {
        const payload = {
          memberId,
          date: loanDate,
          stamps: stamps.map((st) => ({
            shape: st.shape || st.shapeId || st.code,
          })),
        };

        const res = await api.createLoan(payload);
        if (res) {
          await syncSnapshot();
          return res;
        }
      } catch (err) {
        console.warn('[PWA Data] Remote loan disbursal failed, executing offline fallback:', err);
      }
    }

    // Local Optimistic Fallback
    const loanId = 'loan-' + Date.now();
    const ledgerId = 'led-' + Date.now();

    const stampsSummary = (stamps || [])
      .map((s) => {
        const shapeName = s.shape || s.shapeId
          ? (s.shape || s.shapeId).charAt(0).toUpperCase() + (s.shape || s.shapeId).slice(1)
          : 'Stamp';
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
      approvalStatus: 'approved',
      stamps: stamps || [],
    };

    const newLedgerEntry = {
      id: ledgerId,
      type: 'Loan',
      amount: loanPrincipal,
      date: loanDate,
      memberId,
      memberName: resolvedMemberName,
      loanId: loanId,
      description: `Loan Disbursed - ${resolvedMemberName}${stampsSummary ? ` (${stampsSummary})` : ''}`,
    };

    setData((prev) => ({
      ...prev,
      loans: [newLoan, ...prev.loans],
      ledger: [newLedgerEntry, ...prev.ledger],
    }));

    return newLoan;
  };

  // 3. Add Loan Repayment
  const addRepayment = async ({ loanId, memberId, memberName, amountPaid, date, stamps }) => {
    const repaymentDate = date || new Date().toISOString().split('T')[0];
    const targetLoan = data.loans.find((l) => l.id === loanId);
    if (!targetLoan) return;

    const resolvedMemberId = memberId || targetLoan.memberId;
    const resolvedMember = data.members.find((m) => m.id === resolvedMemberId);
    const resolvedMemberName =
      memberName || targetLoan.memberName || resolvedMember?.name || 'Member';

    const canUseApi =
      api.getToken() &&
      isUUID(loanId) &&
      (stamps || []).length > 0;

    if (canUseApi) {
      try {
        const payload = {
          loanId,
          memberId: isUUID(resolvedMemberId) ? resolvedMemberId : undefined,
          date: repaymentDate,
          stamps: stamps.map((st) => ({
            shape: st.shape || st.shapeId || st.code,
          })),
        };

        const res = await api.createRepayment(payload);
        if (res) {
          await syncSnapshot();
          return res;
        }
      } catch (err) {
        console.warn('[PWA Data] Remote repayment failed, executing offline fallback:', err);
      }
    }

    // Local Optimistic Fallback with Waterfall Calculation
    const waterfall = processRepaymentWaterfall(
      targetLoan,
      data.repayments,
      amountPaid,
      repaymentDate
    );

    const repaymentId = 'rep-' + Date.now();
    const ledgerId = 'led-' + Date.now();

    const newRepayment = {
      id: repaymentId,
      loanId: loanId,
      memberId: resolvedMemberId,
      memberName: resolvedMemberName,
      amountPaid: waterfall.amountPaid,
      interestDeducted: waterfall.interestDeducted,
      principalDeducted: waterfall.principalDeducted,
      date: repaymentDate,
      approvalStatus: 'approved',
      stamps: stamps || [],
    };

    const newLedgerEntry = {
      id: ledgerId,
      type: 'Repayment',
      amount: waterfall.amountPaid,
      date: repaymentDate,
      memberId: resolvedMemberId,
      memberName: resolvedMemberName,
      loanId: loanId,
      description: `Loan Repayment - ${resolvedMemberName} (Int: ₹${waterfall.interestDeducted}, Prin: ₹${waterfall.principalDeducted})`,
    };

    const updatedLoans = data.loans.map((loan) => {
      if (loan.id === loanId) {
        return {
          ...loan,
          status: waterfall.willBeFullyPaid ? 'Paid' : 'Active',
        };
      }
      return loan;
    });

    setData((prev) => ({
      ...prev,
      loans: updatedLoans,
      repayments: [newRepayment, ...prev.repayments],
      ledger: [newLedgerEntry, ...prev.ledger],
    }));

    return newRepayment;
  };

  // 4. Reset Data / Re-sync from server
  const resetData = async () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    if (api.getToken()) {
      await syncSnapshot();
    } else {
      setData(EMPTY_GROUP_DATA);
    }
  };

  return (
    <DataContext.Provider
      value={{
        groupProfile: data.groupProfile,
        loanShapes: data.loanShapes?.length > 0 ? data.loanShapes : DEFAULT_LOAN_SHAPES,
        deposits: data.deposits,
        loans: data.loans,
        repayments: data.repayments,
        ledger: data.ledger,
        members: data.members,
        isSyncing,
        syncSnapshot,
        addDeposit,
        createLoan,
        addRepayment,
        resetData,
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
