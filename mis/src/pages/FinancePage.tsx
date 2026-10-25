import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  HandCoins,
  MapPin,
  Pencil,
  RotateCcw,
  Save,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import type { LocationHierarchy, SHGTransactionsGroup } from '../types';
import { api } from '../api/client';

interface FinancePageProps {
  locationHierarchy: LocationHierarchy;
  onRefreshData?: () => void;
}

export const FinancePage: React.FC<FinancePageProps> = ({ locationHierarchy, onRefreshData }) => {
  const [activeTab, setActiveTab] = useState<'transactions' | 'ledger'>('transactions');

  // Transactions Filter State
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedBlock, setSelectedBlock] = useState<string>('');
  const [selectedPanchayat, setSelectedPanchayat] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'all'>('pending');

  // Transactions Data State
  const [loading, setLoading] = useState<boolean>(true);
  const [txData, setTxData] = useState<{ summary: any; shgs: SHGTransactionsGroup[] }>({
    summary: { pendingCount: 0, approvedCount: 0, pendingAmount: 0, approvedAmount: 0 },
    shgs: [],
  });

  // Accordion Expand State: Map of groupId -> boolean
  const [expandedShgs, setExpandedShgs] = useState<Record<string, boolean>>({});

  // Feedback Toasts
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Edit Pending Transaction Modal State
  const [editModal, setEditModal] = useState<{
    open: boolean;
    type: 'deposit' | 'loan';
    item: any;
    date: string;
    note: string;
    principalAmount: number;
    monthlyInterestRate: string;
    memberDeposits: { memberId: string; memberName: string; hhNo: string; stamps: number; amount: number }[];
    stampValue: number;
  }>({
    open: false,
    type: 'deposit',
    item: null,
    date: '',
    note: '',
    principalAmount: 0,
    monthlyInterestRate: '0.0200',
    memberDeposits: [],
    stampValue: 50,
  });

  // Ledger View State
  const [ledgerGroupId, setLedgerGroupId] = useState<string>('');
  const [ledgerFromDate, setLedgerFromDate] = useState<string>('');
  const [ledgerToDate, setLedgerToDate] = useState<string>('');
  const [ledgerType, setLedgerType] = useState<string>('');
  const [ledgerData, setLedgerData] = useState<any>({ summary: {}, entries: [] });
  const [loadingLedger, setLoadingLedger] = useState<boolean>(false);

  // Cascading Location Logic for Filters
  const availableDistricts = useMemo(() => {
    if (!selectedState) return locationHierarchy.districts;
    const tree = locationHierarchy.hierarchy[selectedState];
    return tree ? Object.keys(tree).sort() : [];
  }, [selectedState, locationHierarchy]);

  const availableBlocks = useMemo(() => {
    if (!selectedState && !selectedDistrict) return locationHierarchy.blocks;
    if (selectedState && selectedDistrict) {
      const tree = locationHierarchy.hierarchy[selectedState]?.[selectedDistrict];
      return tree ? Object.keys(tree).sort() : [];
    }
    const blocksSet = new Set<string>();
    for (const st in locationHierarchy.hierarchy) {
      if (locationHierarchy.hierarchy[st][selectedDistrict]) {
        for (const b in locationHierarchy.hierarchy[st][selectedDistrict]) {
          blocksSet.add(b);
        }
      }
    }
    return [...blocksSet].sort();
  }, [selectedState, selectedDistrict, locationHierarchy]);

  const availablePanchayats = useMemo(() => {
    if (selectedState && selectedDistrict && selectedBlock) {
      return locationHierarchy.hierarchy[selectedState]?.[selectedDistrict]?.[selectedBlock] || [];
    }
    return locationHierarchy.panchayats;
  }, [selectedState, selectedDistrict, selectedBlock, locationHierarchy]);

  // Load Transactions
  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const data = await api.getTransactions({
        state: selectedState || undefined,
        district: selectedDistrict || undefined,
        block: selectedBlock || undefined,
        panchayat: selectedPanchayat || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        status: statusFilter,
      });
      setTxData(data);

      // Auto-expand first 2 SHGs with pending items
      const newExpanded: Record<string, boolean> = {};
      data.shgs.slice(0, 3).forEach((shg) => {
        newExpanded[shg.groupId] = true;
      });
      setExpandedShgs(newExpanded);
    } catch (e) {
      console.error('Error fetching transactions:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'transactions') {
      fetchTransactions();
    }
  }, [activeTab, selectedState, selectedDistrict, selectedBlock, selectedPanchayat, fromDate, toDate, statusFilter]);

  // Load Ledger
  const fetchLedger = async () => {
    setLoadingLedger(true);
    try {
      const data = await api.getLedger({
        groupId: ledgerGroupId || undefined,
        fromDate: ledgerFromDate || undefined,
        toDate: ledgerToDate || undefined,
        type: ledgerType || undefined,
      });
      setLedgerData(data);
    } catch (e) {
      console.error('Error fetching ledger:', e);
    } finally {
      setLoadingLedger(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ledger') {
      fetchLedger();
    }
  }, [activeTab, ledgerGroupId, ledgerFromDate, ledgerToDate, ledgerType]);

  const toggleShgExpanded = (groupId: string) => {
    setExpandedShgs((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Handle Approve / Reject
  const handleApprove = async (type: 'deposit' | 'loan', id: string, action: 'approve' | 'reject') => {
    try {
      await api.approveTransaction(type, id, action);
      setActionMessage({
        text: `Transaction ${id.slice(0, 8)} successfully ${action === 'approve' ? 'approved' : 'rejected'}.`,
        type: 'success',
      });
      fetchTransactions();
      if (onRefreshData) onRefreshData();
    } catch (e: any) {
      setActionMessage({ text: e.message || 'Approval action failed', type: 'error' });
    }
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Open Edit Modals
  const handleOpenEditDeposit = (dep: any) => {
    setEditModal({
      open: true,
      type: 'deposit',
      item: dep,
      date: dep.date,
      note: dep.note || '',
      principalAmount: 0,
      monthlyInterestRate: '0.0200',
      memberDeposits: (dep.memberDeposits || []).map((m: any) => ({ ...m })),
      stampValue: dep.stampValue || 50,
    });
  };

  const handleOpenEditLoan = (ln: any) => {
    setEditModal({
      open: true,
      type: 'loan',
      item: ln,
      date: ln.date,
      note: '',
      principalAmount: ln.principalAmount,
      monthlyInterestRate: ln.monthlyInterestRate || '0.0200',
      memberDeposits: [],
      stampValue: 50,
    });
  };

  const handleSaveEdit = async () => {
    if (!editModal.item) return;
    try {
      if (editModal.type === 'deposit') {
        await api.editPendingTransaction('deposit', editModal.item.id, {
          date: editModal.date,
          note: editModal.note,
          memberDeposits: editModal.memberDeposits.map((m) => ({
            memberId: m.memberId,
            stamps: m.stamps,
          })),
        });
        setActionMessage({ text: 'Pending deposit updated successfully.', type: 'success' });
      } else {
        await api.editPendingTransaction('loan', editModal.item.id, {
          date: editModal.date,
          principalAmount: editModal.principalAmount,
          monthlyInterestRate: editModal.monthlyInterestRate,
        });
        setActionMessage({ text: 'Pending loan updated successfully.', type: 'success' });
      }
      setEditModal((prev) => ({ ...prev, open: false }));
      fetchTransactions();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Failed to update transaction', type: 'error' });
    }
    setTimeout(() => setActionMessage(null), 4000);
  };

  const formatRupees = (val: number = 0) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  // Export Ledger to CSV
  const handleExportCsv = () => {
    if (!ledgerData.entries || ledgerData.entries.length === 0) return;
    const headers = ['Date', 'SHG Name', 'Type', 'Amount (INR)', 'Member Name', 'Household No', 'Description'];
    const rows = ledgerData.entries.map((e: any) => [
      e.date,
      `"${e.groupName}"`,
      e.type,
      e.amount,
      `"${e.memberName || ''}"`,
      `"${e.hhNo || ''}"`,
      `"${e.description.replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `shg_plus_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Notification */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-xs font-semibold shadow-md ${
            actionMessage.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-600/20'
              : 'bg-rose-600 text-white shadow-rose-600/20'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Tab Bar */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200/90 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'transactions'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <HandCoins className="w-4 h-4" />
            <span>Transactions & Approvals</span>
            {txData.summary?.pendingCount > 0 && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">
                {txData.summary.pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ledger'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ledger View (By SHG / Dates)</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 px-3">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Real-time Financial Verification</span>
        </div>
      </div>

      {/* TAB 1: TRANSACTIONS & APPROVALS */}
      {activeTab === 'transactions' && (
        <div className="space-y-6">
          {/* Cascading Filter Bar */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Transaction Search & Verification Filters
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      statusFilter === 'pending'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pending Approval
                  </button>
                  <button
                    onClick={() => setStatusFilter('approved')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      statusFilter === 'approved'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Approved
                  </button>
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      statusFilter === 'all'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Status
                  </button>
                </div>

                <button
                  onClick={() => {
                    setSelectedState('');
                    setSelectedDistrict('');
                    setSelectedBlock('');
                    setSelectedPanchayat('');
                    setFromDate('');
                    setToDate('');
                    setStatusFilter('pending');
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Reset Filters"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Hierarchical Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5 mt-4">
              {/* State */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">State</label>
                <select
                  value={selectedState}
                  onChange={(e) => {
                    setSelectedState(e.target.value);
                    setSelectedDistrict('');
                    setSelectedBlock('');
                    setSelectedPanchayat('');
                  }}
                  className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 font-medium cursor-pointer"
                >
                  <option value="">All States</option>
                  {locationHierarchy.states.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* District */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  District
                </label>
                <select
                  value={selectedDistrict}
                  onChange={(e) => {
                    setSelectedDistrict(e.target.value);
                    setSelectedBlock('');
                    setSelectedPanchayat('');
                  }}
                  className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 font-medium cursor-pointer"
                >
                  <option value="">All Districts</option>
                  {availableDistricts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Block */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Block</label>
                <select
                  value={selectedBlock}
                  onChange={(e) => {
                    setSelectedBlock(e.target.value);
                    setSelectedPanchayat('');
                  }}
                  className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 font-medium cursor-pointer"
                >
                  <option value="">All Blocks</option>
                  {availableBlocks.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Panchayat */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Panchayat
                </label>
                <select
                  value={selectedPanchayat}
                  onChange={(e) => setSelectedPanchayat(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 font-medium cursor-pointer"
                >
                  <option value="">All Panchayats</option>
                  {availablePanchayats.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* From Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 font-medium"
                />
              </div>

              {/* To Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 font-medium"
                />
              </div>
            </div>
          </div>

          {/* List of SHGs Accordion */}
          <div className="space-y-4">
            {loading ? (
              <div className="bg-white rounded-2xl p-12 text-center text-slate-400 space-y-3 border border-slate-200">
                <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs font-semibold">Loading transactions by SHG hierarchy...</p>
              </div>
            ) : txData.shgs.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <h3 className="text-base font-bold text-slate-800">No Transactions Found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  {statusFilter === 'pending'
                    ? 'All meeting savings and loan disbursements are fully approved and up to date.'
                    : 'No records matched the selected date or location parameters.'}
                </p>
              </div>
            ) : (
              txData.shgs.map((shg) => {
                const isExpanded = !!expandedShgs[shg.groupId];
                const totalShgItems = shg.deposits.length + shg.loans.length;

                return (
                  <div
                    key={shg.groupId}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all"
                  >
                    {/* SHG Header Card (Click to expand member entries) */}
                    <div
                      onClick={() => toggleShgExpanded(shg.groupId)}
                      className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 transition-colors select-none"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                            shg.pendingCount > 0
                              ? 'bg-amber-100 text-amber-900 border-amber-200'
                              : 'bg-emerald-100 text-emerald-900 border-emerald-200'
                          }`}
                        >
                          {shg.groupName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-900 text-base">{shg.groupName}</h3>
                            {shg.hindiName && <span className="text-xs text-slate-500">{shg.hindiName}</span>}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                            <span>
                              {shg.panchayat}, {shg.block}, {shg.district}, {shg.state}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {shg.pendingCount > 0 && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 animate-spin" />
                            {shg.pendingCount} Pending Approval ({formatRupees(shg.pendingAmount)})
                          </span>
                        )}
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600">
                          {totalShgItems} {totalShgItems === 1 ? 'Entry' : 'Entries'}
                        </span>
                        <div
                          className={`p-1.5 rounded-lg bg-slate-100 text-slate-500 transition-transform ${
                            isExpanded ? 'rotate-180 bg-slate-200' : ''
                          }`}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </div>
                    </div>

                    {/* Expandable Entries Breakdown */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-6 space-y-6">
                        {/* 1. Deposits Section */}
                        {shg.deposits.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              Meeting Savings Deposits ({shg.deposits.length})
                            </h4>

                            <div className="space-y-4">
                              {shg.deposits.map((dep) => (
                                <div
                                  key={dep.id}
                                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4"
                                >
                                  {/* Deposit Top Bar */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                      <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs">
                                        DEP
                                      </div>
                                      <div>
                                        <div className="font-bold text-slate-900 text-sm">
                                          {dep.note || 'Meeting Savings'} — {formatRupees(dep.totalAmount)}
                                        </div>
                                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                          <Calendar className="w-3 h-3 text-slate-400" />
                                          <span>Date: {dep.date}</span>
                                          <span>•</span>
                                          <span>{dep.totalStamps} Total Stamps (₹{dep.stampValue}/stamp)</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Status & Approve Button */}
                                    <div className="flex items-center gap-2.5">
                                      {dep.approvalStatus === 'pending' ? (
                                        <>
                                          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> Pending Approval
                                          </span>
                                          <button
                                            onClick={() => handleOpenEditDeposit(dep)}
                                            className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition-colors border border-indigo-200 cursor-pointer flex items-center gap-1"
                                            title="Edit Pending Deposit"
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                            <span>Edit</span>
                                          </button>
                                          <button
                                            onClick={() => handleApprove('deposit', dep.id, 'approve')}
                                            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer"
                                          >
                                            <Check className="w-3.5 h-3.5" />
                                            <span>Approve</span>
                                          </button>
                                          <button
                                            onClick={() => handleApprove('deposit', dep.id, 'reject')}
                                            className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition-colors border border-rose-200 cursor-pointer"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                            <span>Reject</span>
                                          </button>
                                        </>
                                      ) : (
                                        <span className="px-3 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                          Approved
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Member-Level Breakdown Table */}
                                  <div>
                                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                      <Users className="w-3.5 h-3.5 text-slate-400" />
                                      <span>Member Contribution Breakdown ({dep.memberDeposits.length} Members)</span>
                                    </div>

                                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/30">
                                      <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-100/70 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                                          <tr>
                                            <th className="py-2 px-3">HH No</th>
                                            <th className="py-2 px-3">Member Name</th>
                                            <th className="py-2 px-3 text-center">Stamps Bought</th>
                                            <th className="py-2 px-3 text-right">Contribution Amount</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {dep.memberDeposits.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-white">
                                              <td className="py-2 px-3 font-mono font-semibold text-slate-700">
                                                {item.hhNo}
                                              </td>
                                              <td className="py-2 px-3 font-medium text-slate-900">
                                                {item.memberName}
                                              </td>
                                              <td className="py-2 px-3 text-center font-bold text-slate-800">
                                                {item.stamps} {item.stamps === 1 ? 'stamp' : 'stamps'}
                                              </td>
                                              <td className="py-2 px-3 text-right font-bold text-emerald-700">
                                                {formatRupees(item.amount)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 2. Loans Section */}
                        {shg.loans.length > 0 && (
                          <div className="space-y-3 pt-2">
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                              Loan Disbursements ({shg.loans.length})
                            </h4>

                            <div className="space-y-4">
                              {shg.loans.map((ln) => (
                                <div
                                  key={ln.id}
                                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-purple-50 text-purple-700 font-bold text-xs">
                                      {ln.loanRef}
                                    </div>
                                    <div>
                                      <div className="font-bold text-slate-900 text-sm">
                                        {ln.memberName} ({ln.memberHhNo}) — {formatRupees(ln.principalAmount)}
                                      </div>
                                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                        <Calendar className="w-3 h-3 text-slate-400" />
                                        <span>Date: {ln.date}</span>
                                        <span>•</span>
                                        <span>Shapes: {ln.stamps?.map((s) => s.name).join(', ') || 'Standard'}</span>
                                        <span>•</span>
                                        <span className="font-semibold text-purple-700">2% Monthly Interest</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2.5">
                                    {ln.approvalStatus === 'pending' ? (
                                      <>
                                        <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                                          <Clock className="w-3 h-3" /> Pending Approval
                                        </span>
                                        <button
                                          onClick={() => handleOpenEditLoan(ln)}
                                          className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition-colors border border-indigo-200 cursor-pointer flex items-center gap-1"
                                          title="Edit Pending Loan"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                          <span>Edit</span>
                                        </button>
                                        <button
                                          onClick={() => handleApprove('loan', ln.id, 'approve')}
                                          className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer"
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                          <span>Approve</span>
                                        </button>
                                        <button
                                          onClick={() => handleApprove('loan', ln.id, 'reject')}
                                          className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition-colors border border-rose-200 cursor-pointer"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                          <span>Reject</span>
                                        </button>
                                      </>
                                    ) : (
                                      <span className="px-3 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        Approved
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LEDGER VIEW (BY SHG / DATES) */}
      {activeTab === 'ledger' && (
        <div className="space-y-6">
          {/* Ledger Filters Bar */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  SHG Chronological Ledger Audit Feed
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCsv}
                  disabled={!ledgerData.entries?.length}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              {/* Select SHG */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Select SHG
                </label>
                <select
                  value={ledgerGroupId}
                  onChange={(e) => setLedgerGroupId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 font-medium cursor-pointer"
                >
                  <option value="">All Self Help Groups</option>
                  {txData.shgs?.map((s) => (
                    <option key={s.groupId} value={s.groupId}>
                      {s.groupName} ({s.district})
                    </option>
                  ))}
                </select>
              </div>

              {/* From Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={ledgerFromDate}
                  onChange={(e) => setLedgerFromDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 font-medium"
                />
              </div>

              {/* To Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={ledgerToDate}
                  onChange={(e) => setLedgerToDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 font-medium"
                />
              </div>

              {/* Transaction Type */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Transaction Type
                </label>
                <select
                  value={ledgerType}
                  onChange={(e) => setLedgerType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 font-medium cursor-pointer"
                >
                  <option value="">All Types (Credit & Debit)</option>
                  <option value="deposit">Deposit (Savings Credit)</option>
                  <option value="repayment">Repayment (Loan Recovery Credit)</option>
                  <option value="loan">Loan (Disbursement Debit)</option>
                </select>
              </div>
            </div>

            {/* Ledger Totals Banner */}
            {ledgerData.summary && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-100">
                <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-emerald-800">Total Credit (Deposits/Repay)</span>
                  <div className="text-lg font-extrabold text-emerald-900 mt-0.5">
                    {formatRupees(ledgerData.summary.totalCredit)}
                  </div>
                </div>
                <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-purple-800">Total Debit (Loans Disbursed)</span>
                  <div className="text-lg font-extrabold text-purple-900 mt-0.5">
                    {formatRupees(ledgerData.summary.totalDebit)}
                  </div>
                </div>
                <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-blue-800">Net Ledger Surplus</span>
                  <div className="text-lg font-extrabold text-blue-900 mt-0.5">
                    {formatRupees(ledgerData.summary.netBalance)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Ledger Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">SHG Name</th>
                    <th className="py-3.5 px-4">Member</th>
                    <th className="py-3.5 px-4 text-center">Type</th>
                    <th className="py-3.5 px-4 text-right">Amount</th>
                    <th className="py-3.5 px-6">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingLedger ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        Loading ledger feed...
                      </td>
                    </tr>
                  ) : !ledgerData.entries || ledgerData.entries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No ledger entries found for this selection.
                      </td>
                    </tr>
                  ) : (
                    ledgerData.entries.map((entry: any) => (
                      <tr key={entry.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-mono text-slate-700">{entry.date}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{entry.groupName}</td>
                        <td className="py-3 px-4">
                          {entry.memberName ? (
                            <div>
                              <span className="font-semibold text-slate-800">{entry.memberName}</span>
                              {entry.hhNo && <span className="text-[11px] text-slate-400 ml-1.5 font-mono">({entry.hhNo})</span>}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              entry.type === 'deposit'
                                ? 'bg-emerald-100 text-emerald-800'
                                : entry.type === 'repayment'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {entry.type}
                          </span>
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-bold ${
                            entry.type === 'loan' ? 'text-purple-700' : 'text-emerald-700'
                          }`}
                        >
                          {entry.type === 'loan' ? '-' : '+'}
                          {formatRupees(entry.amount)}
                        </td>
                        <td className="py-3 px-6 text-slate-600">{entry.description}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PENDING TRANSACTION MODAL */}
      {editModal.open && editModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 text-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    Edit Pending {editModal.type === 'deposit' ? 'Meeting Deposit' : 'Loan Disbursement'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Adjust amounts, stamps, or dates before final approval
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditModal((prev) => ({ ...prev, open: false }))}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
              {/* Common Date Input */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Transaction Date *</label>
                <input
                  type="date"
                  value={editModal.date}
                  onChange={(e) => setEditModal({ ...editModal, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Deposit Specific Fields */}
              {editModal.type === 'deposit' && (
                <>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Meeting Note / Description</label>
                    <input
                      type="text"
                      value={editModal.note}
                      onChange={(e) => setEditModal({ ...editModal, note: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                      placeholder="e.g. Regular Meeting Savings"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-slate-300 font-semibold">
                        Member Contributions ({editModal.memberDeposits.length} members)
                      </label>
                      <span className="text-indigo-400 font-mono text-[11px]">
                        Stamp Value: ₹{editModal.stampValue}
                      </span>
                    </div>

                    <div className="rounded-xl border border-slate-800 overflow-hidden max-h-56 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="bg-slate-950/70 border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                          <tr>
                            <th className="p-2.5">HH No</th>
                            <th className="p-2.5">Member</th>
                            <th className="p-2.5 text-center">Stamps</th>
                            <th className="p-2.5 text-right">Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {editModal.memberDeposits.map((m, idx) => (
                            <tr key={m.memberId || idx} className="hover:bg-slate-800/30">
                              <td className="p-2.5 font-mono text-indigo-400 font-semibold">{m.hhNo}</td>
                              <td className="p-2.5 font-medium text-slate-200">{m.memberName}</td>
                              <td className="p-2.5 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max="5"
                                  value={m.stamps}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseInt(e.target.value) || 0);
                                    const next = [...editModal.memberDeposits];
                                    next[idx] = {
                                      ...m,
                                      stamps: val,
                                      amount: val * editModal.stampValue,
                                    };
                                    setEditModal({ ...editModal, memberDeposits: next });
                                  }}
                                  className="w-16 px-2 py-1 text-center rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-bold text-xs focus:border-indigo-500 focus:outline-none"
                                />
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-emerald-400">
                                ₹{m.stamps * editModal.stampValue}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-medium">Recomputed Deposit Total:</span>
                      <span className="text-emerald-400 font-bold text-sm font-mono">
                        {editModal.memberDeposits.reduce((acc, i) => acc + i.stamps, 0)} stamps • ₹
                        {editModal.memberDeposits.reduce((acc, i) => acc + i.stamps * editModal.stampValue, 0)}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Loan Specific Fields */}
              {editModal.type === 'loan' && (
                <>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Borrower</label>
                    <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-300 font-medium">
                      {editModal.item.memberName} ({editModal.item.memberHhNo}) — {editModal.item.loanRef}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Principal Amount (₹) *</label>
                    <input
                      type="number"
                      step="500"
                      min="500"
                      value={editModal.principalAmount}
                      onChange={(e) =>
                        setEditModal({ ...editModal, principalAmount: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Monthly Interest Rate (Decimal, e.g. 0.0200 = 2%)
                    </label>
                    <input
                      type="text"
                      value={editModal.monthlyInterestRate}
                      onChange={(e) =>
                        setEditModal({ ...editModal, monthlyInterestRate: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Equivalent to{' '}
                      {(parseFloat(editModal.monthlyInterestRate || '0.02') * 100).toFixed(1)}% per month (
                      {(parseFloat(editModal.monthlyInterestRate || '0.02') * 12 * 100).toFixed(1)}% p.a.)
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setEditModal((prev) => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium hover:bg-slate-700 transition cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/25 cursor-pointer text-xs"
              >
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
