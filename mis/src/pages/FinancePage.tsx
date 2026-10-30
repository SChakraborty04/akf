import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  HandCoins,
  History,
  MapPin,
  Pencil,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import type {
  LedgerEntry,
  LocationHierarchy,
  SHGGroup,
  SHGTransactionsGroup,
  SHGWeeklyFinanceResponse,
  WeeklyPaymentMemberDetail,
  WeeklyPaymentRow,
} from '../types';
import { api } from '../api/client';

interface FinancePageProps {
  locationHierarchy: LocationHierarchy;
  onRefreshData?: () => void;
}

export const FinancePage: React.FC<FinancePageProps> = ({ locationHierarchy, onRefreshData }) => {
  const currentUser = api.getUser();
  const [activeTab, setActiveTab] = useState<'transactions' | 'ledger'>('transactions');

  // Multi-level Drill-down Navigation State:
  // Level 1: All Accessible SHGs (selectedShg === null)
  // Level 2: Weekly Overview of Selected SHG (selectedShg !== null, selectedWeek === null)
  // Level 3: Member-wise Details of Selected Week (selectedWeek !== null, selectedMember === null)
  // Level 4: Selected Member Savings & Payment History (selectedMember !== null)
  const [selectedShg, setSelectedShg] = useState<SHGGroup | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<WeeklyPaymentRow | null>(null);
  const [selectedMember, setSelectedMember] = useState<WeeklyPaymentMemberDetail | null>(null);

  // Weekly Finance Data for the currently selected SHG
  const [weeklyFinanceData, setWeeklyFinanceData] = useState<SHGWeeklyFinanceResponse | null>(null);
  const [loadingWeekly, setLoadingWeekly] = useState<boolean>(false);

  // Filter State
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedBlock, setSelectedBlock] = useState<string>('');
  const [selectedPanchayat, setSelectedPanchayat] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Initial SHG List Data State
  const [loadingShgs, setLoadingShgs] = useState<boolean>(true);
  const [allShgs, setAllShgs] = useState<SHGGroup[]>([]);
  const [shgTransactions, setShgTransactions] = useState<SHGTransactionsGroup[]>([]);
  const [summaryStats, setSummaryStats] = useState<{
    pendingCount: number;
    approvedCount: number;
    pendingAmount: number;
    approvedAmount: number;
  }>({
    pendingCount: 0,
    approvedCount: 0,
    pendingAmount: 0,
    approvedAmount: 0,
  });

  // Feedback Notification Toast
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Member Weekly Edit Modal State
  const [editModal, setEditModal] = useState<{
    open: boolean;
    member: WeeklyPaymentMemberDetail | null;
    stamps: number;
    depositAmount: number;
    loanDisbursed: number;
    repayment: number;
    autoApprove: boolean;
    saving: boolean;
  }>({
    open: false,
    member: null,
    stamps: 0,
    depositAmount: 0,
    loanDisbursed: 0,
    repayment: 0,
    autoApprove: true,
    saving: false,
  });

  // Ledger Tab State
  const [ledgerGroupId, setLedgerGroupId] = useState<string>('');
  const [ledgerFromDate, setLedgerFromDate] = useState<string>('');
  const [ledgerToDate, setLedgerToDate] = useState<string>('');
  const [ledgerType, setLedgerType] = useState<string>('');
  const [ledgerData, setLedgerData] = useState<any>({ summary: {}, entries: [] });
  const [loadingLedger, setLoadingLedger] = useState<boolean>(false);

  // Currency Formatter
  const formatRupees = (val: number = 0) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val);

  // Date Formatter (DD-MM-YYYY)
  const formatDisplayDate = (dStr: string) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dStr;
  };

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

  // Load Initial SHGs and Approvals Data
  const loadShgs = async () => {
    setLoadingShgs(true);
    try {
      const [groupsData, txRes] = await Promise.all([
        api.getGroups({
          state: selectedState || undefined,
          district: selectedDistrict || undefined,
          block: selectedBlock || undefined,
          panchayat: selectedPanchayat || undefined,
          search: searchQuery || undefined,
        }),
        api.getTransactions({
          state: selectedState || undefined,
          district: selectedDistrict || undefined,
          block: selectedBlock || undefined,
          panchayat: selectedPanchayat || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          status: statusFilter,
        }),
      ]);

      // User Access Scoping:
      // DO -> only assignedGroupIds; SHG / operator -> only their groupId; Admin -> all
      let accessible = groupsData || [];
      if (currentUser?.role === 'shg' || currentUser?.role === 'operator') {
        accessible = accessible.filter((g) => g.id === currentUser.groupId);
      } else if (currentUser?.role === 'do' && currentUser.assignedGroupIds && currentUser.assignedGroupIds.length > 0) {
        accessible = accessible.filter((g) => currentUser.assignedGroupIds!.includes(g.id));
      }

      setAllShgs(accessible);
      if (txRes?.shgs) setShgTransactions(txRes.shgs);
      if (txRes?.summary) setSummaryStats(txRes.summary);
    } catch (err) {
      console.error('Error fetching SHGs:', err);
    } finally {
      setLoadingShgs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'transactions' && !selectedShg) {
      loadShgs();
    }
  }, [activeTab, selectedState, selectedDistrict, selectedBlock, selectedPanchayat, statusFilter, fromDate, toDate, searchQuery]);

  // Load Weekly Data when an SHG is selected
  const fetchWeeklyFinance = async (groupId: string) => {
    setLoadingWeekly(true);
    try {
      const data = await api.getShgWeeklyFinance(groupId);
      setWeeklyFinanceData(data);

      // If a week was already selected, sync it with updated data
      if (selectedWeek) {
        const updatedWeek = data.weeks.find((w) => w.date === selectedWeek.date);
        if (updatedWeek) {
          setSelectedWeek(updatedWeek);
          // If a member was selected, sync member data as well
          if (selectedMember) {
            const updatedMember = updatedWeek.members.find((m) => m.memberId === selectedMember.memberId);
            if (updatedMember) setSelectedMember(updatedMember);
          }
        }
      }
    } catch (err: any) {
      console.error('Error loading weekly finance:', err);
      setActionMessage({ text: err.message || 'Failed to load weekly financial details', type: 'error' });
    } finally {
      setLoadingWeekly(false);
    }
  };

  const handleSelectShg = (shg: SHGGroup) => {
    setSelectedShg(shg);
    setSelectedWeek(null);
    setSelectedMember(null);
    fetchWeeklyFinance(shg.id);
  };

  const handleSelectWeek = (week: WeeklyPaymentRow) => {
    setSelectedWeek(week);
    setSelectedMember(null);
  };

  const handleSelectMember = (member: WeeklyPaymentMemberDetail) => {
    setSelectedMember(member);
  };

  // Approve an individual member's transaction in a week -> triggers x++
  const handleApproveMember = async (member: WeeklyPaymentMemberDetail) => {
    if (!selectedShg || !selectedWeek) return;
    try {
      await api.approveMemberWeekly(selectedShg.id, selectedWeek.date, member.memberId, 'approve');

      // Optimistic instant UI update (x++)
      setWeeklyFinanceData((prev) => {
        if (!prev) return prev;
        const newWeeks = prev.weeks.map((w) => {
          if (w.date !== selectedWeek.date) return w;
          const updatedMembers = w.members.map((m) =>
            m.memberId === member.memberId ? { ...m, approvalStatus: 'approved' as const } : m,
          );
          const newApprovedCount = updatedMembers.filter((m) => m.approvalStatus === 'approved').length;
          const isFullyApproved = newApprovedCount === w.totalCount;
          return {
            ...w,
            approvedCount: newApprovedCount,
            approvalRatio: `${newApprovedCount}/${w.totalCount}`,
            approvalStatus: isFullyApproved ? ('approved' as const) : ('pending' as const),
            members: updatedMembers,
          };
        });
        return { ...prev, weeks: newWeeks };
      });

      // Update selectedWeek in place
      setSelectedWeek((prev) => {
        if (!prev) return prev;
        const updatedMembers = prev.members.map((m) =>
          m.memberId === member.memberId ? { ...m, approvalStatus: 'approved' as const } : m,
        );
        const newApprovedCount = updatedMembers.filter((m) => m.approvalStatus === 'approved').length;
        return {
          ...prev,
          approvedCount: newApprovedCount,
          approvalRatio: `${newApprovedCount}/${prev.totalCount}`,
          approvalStatus: newApprovedCount === prev.totalCount ? 'approved' : 'pending',
          members: updatedMembers,
        };
      });

      setActionMessage({
        text: `✓ ${member.memberName} verified and approved for Week ${selectedWeek.weekNo}.`,
        type: 'success',
      });
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Approval failed', type: 'error' });
    }
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Approve all member transactions for the week at once (e.g., 12/12)
  const handleApproveAllWeek = async () => {
    if (!selectedShg || !selectedWeek) return;
    try {
      await api.approveWeekAll(selectedShg.id, selectedWeek.date, 'approve');

      // Optimistic instant UI update
      setWeeklyFinanceData((prev) => {
        if (!prev) return prev;
        const newWeeks = prev.weeks.map((w) => {
          if (w.date !== selectedWeek.date) return w;
          const updatedMembers = w.members.map((m) => ({ ...m, approvalStatus: 'approved' as const }));
          return {
            ...w,
            approvedCount: w.totalCount,
            approvalRatio: `${w.totalCount}/${w.totalCount}`,
            approvalStatus: 'approved' as const,
            members: updatedMembers,
          };
        });
        return { ...prev, weeks: newWeeks };
      });

      setSelectedWeek((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          approvedCount: prev.totalCount,
          approvalRatio: `${prev.totalCount}/${prev.totalCount}`,
          approvalStatus: 'approved',
          members: prev.members.map((m) => ({ ...m, approvalStatus: 'approved' })),
        };
      });

      setActionMessage({
        text: `✓ All ${selectedWeek.totalCount} member transactions approved for Week ${selectedWeek.weekNo}.`,
        type: 'success',
      });
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Weekly approval failed', type: 'error' });
    }
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Open Edit Modal for a member's weekly figures
  const handleOpenEditMember = (member: WeeklyPaymentMemberDetail) => {
    setEditModal({
      open: true,
      member,
      stamps: member.noOfStamps,
      depositAmount: member.totalDeposit,
      loanDisbursed: member.loanDisbursed,
      repayment: member.repayment,
      autoApprove: true,
      saving: false,
    });
  };

  // Save changes to member weekly transaction
  const handleSaveMemberEdit = async () => {
    if (!selectedShg || !selectedWeek || !editModal.member) return;
    setEditModal((prev) => ({ ...prev, saving: true }));
    try {
      await api.editMemberWeekly(selectedShg.id, selectedWeek.date, editModal.member.memberId, {
        stamps: editModal.stamps,
        depositAmount: editModal.depositAmount,
        loanDisbursed: editModal.loanDisbursed,
        repayment: editModal.repayment,
        autoApprove: editModal.autoApprove,
      });

      setActionMessage({
        text: `✓ ${editModal.member.memberName}'s figures updated${editModal.autoApprove ? ' and approved' : ''}.`,
        type: 'success',
      });

      setEditModal((prev) => ({ ...prev, open: false, saving: false }));
      // Refresh the weekly ledger
      fetchWeeklyFinance(selectedShg.id);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Failed to update member transaction', type: 'error' });
      setEditModal((prev) => ({ ...prev, saving: false }));
    }
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Filtered SHGs in Level 1
  const displayedShgs = useMemo(() => {
    return allShgs.filter((g) => {
      // Find matching transactions group for pending counts
      const tx = shgTransactions.find((t) => t.groupId === g.id);
      const pendingCount = tx?.pendingCount ?? 0;
      const approvedCount = tx?.approvedCount ?? 0;

      if (statusFilter === 'pending' && pendingCount === 0) return false;
      if (statusFilter === 'approved' && approvedCount === 0 && pendingCount > 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = g.name.toLowerCase().includes(q) || (g.hindiName && g.hindiName.includes(q));
        const matchesLoc =
          g.village?.toLowerCase().includes(q) ||
          g.panchayat.toLowerCase().includes(q) ||
          g.block.toLowerCase().includes(q);
        if (!matchesName && !matchesLoc) return false;
      }

      return true;
    });
  }, [allShgs, shgTransactions, statusFilter, searchQuery]);

  // Filtered Weeks in Level 2
  const displayedWeeks = useMemo(() => {
    if (!weeklyFinanceData) return [];
    return weeklyFinanceData.weeks.filter((w) => {
      if (statusFilter === 'pending' && w.approvalStatus === 'approved') return false;
      if (statusFilter === 'approved' && w.approvalStatus === 'pending') return false;
      if (fromDate && w.date < fromDate) return false;
      if (toDate && w.date > toDate) return false;
      return true;
    });
  }, [weeklyFinanceData, statusFilter, fromDate, toDate]);

  // Filtered Members in Level 3
  const displayedWeekMembers = useMemo(() => {
    if (!selectedWeek) return [];
    return selectedWeek.members.filter((m) => {
      if (statusFilter === 'pending' && m.approvalStatus === 'approved') return false;
      if (statusFilter === 'approved' && m.approvalStatus === 'pending') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches = m.memberName.toLowerCase().includes(q) || m.hhNo.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [selectedWeek, statusFilter, searchQuery]);

  // Load Ledger Tab
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

  // Export Ledger to CSV
  const handleExportCsv = () => {
    if (!ledgerData.entries || ledgerData.entries.length === 0) return;
    const headers = ['Date', 'SHG Name', 'Type', 'Amount (INR)', 'Member Name', 'Household No', 'Description'];
    const rows = ledgerData.entries.map((e: LedgerEntry) => [
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
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Toast Notification */}
      {actionMessage && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-lg transition-all ${
            actionMessage.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-600/25 ring-1 ring-emerald-500'
              : 'bg-rose-600 text-white shadow-rose-600/25 ring-1 ring-rose-500'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="font-medium text-sm">{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="p-1 rounded-lg hover:bg-white/20 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Tab Bar */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveTab('transactions');
              setSelectedShg(null);
              setSelectedWeek(null);
              setSelectedMember(null);
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'transactions'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <HandCoins className="w-4 h-4" />
            <span>Transaction & Approval</span>
            {summaryStats.pendingCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">
                {summaryStats.pendingCount}
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
            <span>Financial Ledger (All SHGs / Entries)</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 px-3">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Real-time Financial Verification & Approval Workflow</span>
        </div>
      </div>

      {/* TAB 1: TRANSACTIONS & APPROVALS MULTI-LEVEL DRILL-DOWN */}
      {activeTab === 'transactions' && (
        <div className="space-y-6">
          {/* Breadcrumb Navigation Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 overflow-x-auto py-1">
              <button
                onClick={() => {
                  setSelectedShg(null);
                  setSelectedWeek(null);
                  setSelectedMember(null);
                }}
                className={`hover:text-emerald-700 transition cursor-pointer flex items-center gap-1.5 ${
                  !selectedShg ? 'text-emerald-700 font-bold' : 'text-slate-500'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>All Accessible SHGs</span>
              </button>

              {selectedShg && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <button
                    onClick={() => {
                      setSelectedWeek(null);
                      setSelectedMember(null);
                    }}
                    className={`hover:text-emerald-700 transition cursor-pointer font-bold ${
                      selectedShg && !selectedWeek ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {selectedShg.name}
                  </button>
                </>
              )}

              {selectedWeek && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <button
                    onClick={() => setSelectedMember(null)}
                    className={`hover:text-emerald-700 transition cursor-pointer font-bold ${
                      selectedWeek && !selectedMember ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    Week {selectedWeek.weekNo} ({selectedWeek.displayDate})
                  </button>
                </>
              )}

              {selectedMember && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <History className="w-3.5 h-3.5" />
                    <span>
                      {selectedMember.memberName} ({selectedMember.hhNo}) — Financial History
                    </span>
                  </span>
                </>
              )}
            </div>

            {/* Back Buttons */}
            <div>
              {selectedMember ? (
                <button
                  onClick={() => setSelectedMember(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Week Members</span>
                </button>
              ) : selectedWeek ? (
                <button
                  onClick={() => setSelectedWeek(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Weekly Payment Details</span>
                </button>
              ) : selectedShg ? (
                <button
                  onClick={() => setSelectedShg(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to SHG List</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* Persistent Filter Bar */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Filter by Location, Status & Date Range
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Status Filter Buttons */}
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
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
                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      statusFilter === 'pending'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Pending Approval</span>
                    {summaryStats.pendingCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-slate-950 text-white text-[9px]">
                        {summaryStats.pendingCount}
                      </span>
                    )}
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
                </div>

                <button
                  onClick={() => {
                    setSelectedState('');
                    setSelectedDistrict('');
                    setSelectedBlock('');
                    setSelectedPanchayat('');
                    setFromDate('');
                    setToDate('');
                    setStatusFilter('all');
                    setSearchQuery('');
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                  title="Reset Filters"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5 mt-4">
              {/* Search */}
              <div className="lg:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Search
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      selectedWeek
                        ? 'Search member name or household #...'
                        : 'Search SHG name, village, block...'
                    }
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 font-medium focus:bg-white focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* State */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  State
                </label>
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
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Block
                </label>
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
            </div>
          </div>

          {/* ========================================================================= */}
          {/* LEVEL 1: LIST OF ALL ACCESSIBLE SHGs (INITIAL VIEW)                       */}
          {/* ========================================================================= */}
          {!selectedShg && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Self Help Groups ({displayedShgs.length} Accessible)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select any SHG to inspect its weekly meeting payments, box balance, and member transactions.
                  </p>
                </div>
              </div>

              {loadingShgs ? (
                <div className="bg-white rounded-2xl p-12 text-center text-slate-400 space-y-3 border border-slate-200 shadow-xs">
                  <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs font-semibold">Loading accessible SHGs...</p>
                </div>
              ) : displayedShgs.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200 shadow-xs">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <h3 className="text-base font-bold text-slate-800">No SHGs Found</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    {statusFilter === 'pending'
                      ? 'No SHGs currently have pending transactions awaiting verification.'
                      : 'No SHGs matched the selected location or search criteria.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {displayedShgs.map((shg) => {
                    const tx = shgTransactions.find((t) => t.groupId === shg.id);
                    const pendingCount = tx?.pendingCount ?? 0;
                    const pendingAmt = tx?.pendingAmount ?? 0;
                    const hasPending = pendingCount > 0;

                    return (
                      <div
                        key={shg.id}
                        onClick={() => handleSelectShg(shg)}
                        className={`bg-white rounded-2xl p-5 border transition-all cursor-pointer hover:shadow-md hover:border-emerald-500 group flex flex-col justify-between ${
                          hasPending ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                                  hasPending
                                    ? 'bg-amber-100 text-amber-900 border-amber-200'
                                    : 'bg-emerald-100 text-emerald-900 border-emerald-200'
                                }`}
                              >
                                {shg.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition">
                                  {shg.name}
                                </h3>
                                {shg.hindiName && (
                                  <span className="text-xs text-slate-500 font-medium">{shg.hindiName}</span>
                                )}
                              </div>
                            </div>

                            {hasPending ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shrink-0 animate-pulse">
                                <Clock className="w-3 h-3" />
                                <span>{pendingCount} Pending</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 shrink-0">
                                <Check className="w-3 h-3" />
                                <span>Verified</span>
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-3">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate">
                              {shg.village ? `${shg.village}, ` : ''}
                              {shg.panchayat}, {shg.block}, {shg.district}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs mb-3">
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                                Members
                              </span>
                              <span className="font-bold text-slate-800">{shg.memberCount ?? 12} Registered</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                                Stamp Value
                              </span>
                              <span className="font-bold text-slate-800">₹{shg.stampValue} / Stamp</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                                Meeting Day
                              </span>
                              <span className="font-bold text-slate-800">{shg.meetingDay || 'Weekly'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                                Total Savings
                              </span>
                              <span className="font-bold text-emerald-700">
                                {formatRupees(shg.totalDeposits ?? 0)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                          {hasPending ? (
                            <span className="text-amber-700 font-bold">
                              ₹{pendingAmt.toLocaleString('en-IN')} awaiting review
                            </span>
                          ) : (
                            <span className="text-slate-400">All weeks verified</span>
                          )}
                          <span className="font-bold text-emerald-700 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                            <span>Inspect Payments</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* LEVEL 2: WEEKLY PAYMENT DETAILS FOR SELECTED SHG                          */}
          {/* ========================================================================= */}
          {selectedShg && !selectedWeek && (
            <div className="space-y-6">
              {/* SHG Header Banner */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-emerald-600/20">
                    {selectedShg.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-900">{selectedShg.name}</h2>
                      {selectedShg.hindiName && (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                          {selectedShg.hindiName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        {selectedShg.village ? `${selectedShg.village}, ` : ''}
                        {selectedShg.panchayat}, {selectedShg.block}, {selectedShg.district}, {selectedShg.state}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span>Meeting Day: {selectedShg.meetingDay || 'Weekly'}</span>
                      <span className="text-slate-300">•</span>
                      <span>₹{selectedShg.stampValue} / Stamp</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      Box Cash Balance
                    </span>
                    <span className="text-base font-black text-emerald-700 font-mono">
                      {formatRupees(weeklyFinanceData?.currentBoxAmount ?? 0)}
                    </span>
                  </div>
                  <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      Loan Outstanding
                    </span>
                    <span className="text-base font-black text-slate-900 font-mono">
                      {formatRupees(weeklyFinanceData?.currentOutstandingAmount ?? 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Weekly Payment Details Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Weekly Payment & Meeting Details ({displayedWeeks.length} Weeks)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select any week to verify member contributions, loans disbursed, and edit or approve entries.
                    </p>
                  </div>
                </div>

                {loadingWeekly ? (
                  <div className="p-12 text-center text-slate-400 space-y-3">
                    <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-xs font-semibold">Calculating weekly financial schedules...</p>
                  </div>
                ) : displayedWeeks.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <h4 className="font-bold text-slate-700 text-sm">No Weekly Records Found</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      No meeting transactions match the selected filter conditions for this SHG.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="py-3.5 px-4">Week No</th>
                          <th className="py-3.5 px-4">Date</th>
                          <th className="py-3.5 px-4 text-right">Total Deposit</th>
                          <th className="py-3.5 px-4 text-center">No of Stamps</th>
                          <th className="py-3.5 px-4 text-right">Loan Disbursed</th>
                          <th className="py-3.5 px-4 text-right">Re-Payment</th>
                          <th className="py-3.5 px-4 text-right">Box Amount</th>
                          <th className="py-3.5 px-4 text-right">Outstanding Amount</th>
                          <th className="py-3.5 px-4 text-center">Approved (x/{weeklyFinanceData?.totalMembers ?? 12})</th>
                          <th className="py-3.5 px-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {displayedWeeks.map((week) => {
                          const isFullyApproved = week.approvedCount === week.totalCount;

                          return (
                            <tr
                              key={week.weekNo + week.date}
                              onClick={() => handleSelectWeek(week)}
                              className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                            >
                              <td className="py-3.5 px-4 font-mono font-bold text-emerald-800">
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200">
                                  {week.weekNo}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span>{week.displayDate}</span>
                                  {week.isCurrentWeek && (
                                    <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase">
                                      Current
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                                {formatRupees(week.totalDeposit)}
                              </td>
                              <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-700">
                                {week.noOfStamps}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-semibold text-rose-700">
                                {formatRupees(week.loanDisbursed)}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-semibold text-blue-700">
                                {formatRupees(week.repayment)}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 bg-slate-50/50">
                                {formatRupees(week.boxAmount)}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700">
                                {formatRupees(week.outstandingAmount)}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                    isFullyApproved
                                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                      : 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                                  }`}
                                >
                                  {isFullyApproved ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                                  ) : (
                                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                                  )}
                                  <span>
                                    {week.approvalRatio} {isFullyApproved ? 'Approved' : 'Verified'}
                                  </span>
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectWeek(week);
                                  }}
                                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-emerald-700 font-bold transition text-xs flex items-center gap-1 mx-auto cursor-pointer shadow-xs"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View Members</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* LEVEL 3: WEEKLY PAYMENT DETAILS MEMBER-WISE (FOR SELECTED WEEK)           */}
          {/* ========================================================================= */}
          {selectedShg && selectedWeek && !selectedMember && (
            <div className="space-y-6">
              {/* Week Header Summary Banner */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="px-3 py-1 rounded-xl bg-emerald-600 text-white font-black text-sm font-mono">
                      Week {selectedWeek.weekNo}
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">
                      Weekly Meeting: {selectedWeek.displayDate}
                    </h2>
                    {selectedWeek.isCurrentWeek && (
                      <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 text-xs font-black">
                        Current Week
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedShg.name} • {selectedWeek.members.length} Members Registered • Stamp Value: ₹
                    {selectedShg.stampValue}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Approval Counter Badge (x/12) */}
                  <div
                    className={`px-4 py-2 rounded-xl border flex items-center gap-3 ${
                      selectedWeek.approvedCount === selectedWeek.totalCount
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                        Approval Progress
                      </span>
                      <span className="font-black text-base font-mono">
                        {selectedWeek.approvedCount} / {selectedWeek.totalCount} Approved
                      </span>
                    </div>
                    {selectedWeek.approvedCount < selectedWeek.totalCount && (
                      <button
                        onClick={handleApproveAllWeek}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1"
                        title="Approve all remaining pending member records for this week"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve All (12/12)</span>
                      </button>
                    )}
                  </div>

                  <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      Meeting Box Cash
                    </span>
                    <span className="font-mono font-black text-emerald-700 text-sm">
                      {formatRupees(selectedWeek.boxAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Member-Wise Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Member-wise Payments, Savings & Loans for Week {selectedWeek.weekNo}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Current week transactions are editable and approvable per member. Click member name to view full history.
                    </p>
                  </div>

                  <div className="text-xs text-slate-500 font-semibold">
                    Showing {displayedWeekMembers.length} of {selectedWeek.members.length} Members
                  </div>
                </div>

                {displayedWeekMembers.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <h4 className="font-bold text-slate-700 text-sm">No Members Matched Filter</h4>
                    <p className="text-xs text-slate-500 mt-1">Try resetting the status or search filter above.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="py-3.5 px-4">Week No</th>
                          <th className="py-3.5 px-4">Date</th>
                          <th className="py-3.5 px-4">Member Name</th>
                          <th className="py-3.5 px-4 text-right">Total Deposit</th>
                          <th className="py-3.5 px-4 text-center">No of Stamps</th>
                          <th className="py-3.5 px-4 text-right">Loan Disbursed</th>
                          <th className="py-3.5 px-4 text-right">Re-Payment</th>
                          <th className="py-3.5 px-4 text-right">Balance Amount</th>
                          <th className="py-3.5 px-4 text-right">Outstanding Amount</th>
                          <th className="py-3.5 px-4 text-center">Status</th>
                          <th className="py-3.5 px-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {displayedWeekMembers.map((m) => {
                          const isApproved = m.approvalStatus === 'approved';

                          return (
                            <tr
                              key={m.memberId}
                              className={`hover:bg-slate-50/80 transition-colors ${
                                !isApproved ? 'bg-amber-50/30' : ''
                              }`}
                            >
                              <td className="py-3.5 px-4 font-mono font-bold text-slate-500">{m.weekNo}</td>
                              <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">{m.displayDate}</td>
                              <td className="py-3.5 px-4">
                                <button
                                  onClick={() => handleSelectMember(m)}
                                  className="text-left group cursor-pointer"
                                  title="Click to view complete member history"
                                >
                                  <div className="font-bold text-slate-900 group-hover:text-emerald-700 transition flex items-center gap-1.5">
                                    <span>{m.memberName}</span>
                                    <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-emerald-700" />
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-mono font-semibold">{m.hhNo}</span>
                                </button>
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                                {formatRupees(m.totalDeposit)}
                              </td>
                              <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-700">
                                {m.noOfStamps}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-semibold text-rose-700">
                                {formatRupees(m.loanDisbursed)}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-semibold text-blue-700">
                                {formatRupees(m.repayment)}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-black text-slate-800 bg-slate-50/40">
                                {formatRupees(m.balanceAmount)}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700">
                                {formatRupees(m.outstandingAmount)}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                {isApproved ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <Check className="w-3 h-3" />
                                    <span>Approved</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                                    <Clock className="w-3 h-3" />
                                    <span>Pending</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="flex items-center justify-center gap-1.5">
                                  {/* Approve Button (increments x++) */}
                                  {!isApproved && (
                                    <button
                                      onClick={() => handleApproveMember(m)}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition cursor-pointer flex items-center gap-1 shadow-xs"
                                      title="Approve this member's weekly transaction (x++)"
                                    >
                                      <Check className="w-3 h-3" />
                                      <span>Approve</span>
                                    </button>
                                  )}

                                  {/* Edit Button */}
                                  <button
                                    onClick={() => handleOpenEditMember(m)}
                                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                                    title="Edit Stamps, Deposit, Loan or Repayment"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Full Member History */}
                                  <button
                                    onClick={() => handleSelectMember(m)}
                                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition cursor-pointer"
                                    title="View Member Historical Timeline"
                                  >
                                    <History className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* LEVEL 4: HISTORY OF SAVINGS AND PAYMENT MEMBER-WISE                       */}
          {/* ========================================================================= */}
          {selectedShg && selectedMember && (
            <div className="space-y-6">
              {/* Member Profile Banner */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-indigo-600/20">
                    {selectedMember.memberName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-xl font-bold text-slate-900">{selectedMember.memberName}</h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 text-xs font-mono font-bold">
                        {selectedMember.hhNo}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Member of {selectedShg.name} • {selectedShg.village}, {selectedShg.panchayat}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-right">
                    <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">
                      Total Savings Balance
                    </span>
                    <span className="text-base font-black text-emerald-700 font-mono">
                      {formatRupees(selectedMember.balanceAmount)}
                    </span>
                  </div>
                  <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      Loan Outstanding
                    </span>
                    <span className="text-base font-black text-slate-900 font-mono">
                      {formatRupees(selectedMember.outstandingAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* History Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      History of Savings and Payment — {selectedMember.memberName}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Chronological meeting-by-meeting financial timeline including stamp purchases, disbursements, and repayments.
                    </p>
                  </div>
                </div>

                {(!weeklyFinanceData?.memberHistories[selectedMember.memberId] ||
                  weeklyFinanceData.memberHistories[selectedMember.memberId].length === 0) ? (
                  <div className="p-12 text-center text-slate-400">
                    <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <h4 className="font-bold text-slate-700 text-sm">No History Records Available</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      This member has no recorded savings or loan payments yet.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="py-3.5 px-4">Week No</th>
                          <th className="py-3.5 px-4">Date</th>
                          <th className="py-3.5 px-4 text-right">Total Deposit</th>
                          <th className="py-3.5 px-4 text-center">No of Stamps</th>
                          <th className="py-3.5 px-4 text-right">Loan Disbursed</th>
                          <th className="py-3.5 px-4 text-right">Re-Payment</th>
                          <th className="py-3.5 px-4 text-right">Balance Amount</th>
                          <th className="py-3.5 px-4 text-right">Outstanding Amount</th>
                          <th className="py-3.5 px-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {weeklyFinanceData.memberHistories[selectedMember.memberId].map((h, i) => (
                          <tr key={h.weekNo + h.date + i} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-bold text-emerald-800">{h.weekNo}</td>
                            <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap">{h.displayDate}</td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                              {formatRupees(h.totalDeposit)}
                            </td>
                            <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-700">
                              {h.noOfStamps}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-semibold text-rose-700">
                              {formatRupees(h.loanDisbursed)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-semibold text-blue-700">
                              {formatRupees(h.repayment)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 bg-slate-50/40">
                              {formatRupees(h.balanceAmount)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700">
                              {formatRupees(h.outstandingAmount)}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {h.approvalStatus === 'approved' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <Check className="w-3 h-3" />
                                  <span>Approved</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  <Clock className="w-3 h-3" />
                                  <span>Pending</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: FINANCIAL LEDGER VIEW (ALL SHGs / RAW AUDIT TRAIL)                */}
      {/* ========================================================================= */}
      {activeTab === 'ledger' && (
        <div className="space-y-6">
          {/* Ledger Filter Bar */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Audit Feed & Financial Transactions Ledger
                </span>
              </div>
              <button
                onClick={handleExportCsv}
                disabled={!ledgerData.entries || ledgerData.entries.length === 0}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV Report</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Select SHG
                </label>
                <select
                  value={ledgerGroupId}
                  onChange={(e) => setLedgerGroupId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 font-medium cursor-pointer"
                >
                  <option value="">All SHGs</option>
                  {allShgs.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

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
                  <option value="deposit">Deposit (Savings)</option>
                  <option value="loan">Loan (Disbursement)</option>
                  <option value="repayment">Repayment (Receipt)</option>
                </select>
              </div>

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
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Total Credit</span>
              <span className="text-xl font-black text-emerald-700 font-mono mt-1 block">
                {formatRupees(ledgerData.summary?.totalCredit ?? 0)}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">Savings Deposits + Loan Repayments</span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Total Debit</span>
              <span className="text-xl font-black text-rose-700 font-mono mt-1 block">
                {formatRupees(ledgerData.summary?.totalDebit ?? 0)}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">Disbursed Loans</span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Net Balance</span>
              <span className="text-xl font-black text-slate-900 font-mono mt-1 block">
                {formatRupees(ledgerData.summary?.netBalance ?? 0)}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">Available Liquid Funds in Circulation</span>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {loadingLedger ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs font-semibold">Loading ledger transactions feed...</p>
              </div>
            ) : !ledgerData.entries || ledgerData.entries.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="font-bold text-slate-700 text-sm">No Ledger Entries Found</h4>
                <p className="text-xs text-slate-500 mt-1">Try adjusting the dates or transaction type filter above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">SHG Group</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4">Member</th>
                      <th className="py-3 px-4">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {ledgerData.entries.map((e: LedgerEntry) => (
                      <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                          {formatDisplayDate(e.date)}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">{e.groupName}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              e.type === 'deposit'
                                ? 'bg-emerald-100 text-emerald-800'
                                : e.type === 'repayment'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {e.type}
                          </span>
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono font-bold ${
                            e.type === 'loan' ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {e.type === 'loan' ? '-' : '+'}
                          {formatRupees(e.amount)}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {e.memberName ? (
                            <span>
                              {e.memberName} <span className="font-mono text-slate-400 text-[10px]">({e.hhNo})</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{e.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MEMBER TRANSACTION EDIT MODAL                                             */}
      {/* ========================================================================= */}
      {editModal.open && editModal.member && selectedShg && selectedWeek && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Edit Member Transaction</h3>
                  <p className="text-xs text-slate-500">
                    Week {selectedWeek.weekNo} ({selectedWeek.displayDate}) • {selectedShg.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditModal((prev) => ({ ...prev, open: false }))}
                className="p-1 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Member Details
                </span>
                <span className="font-bold text-slate-900 text-sm block mt-0.5">
                  {editModal.member.memberName}
                </span>
                <span className="text-slate-500 font-mono text-[11px]">
                  Household #{editModal.member.hhNo}
                </span>
              </div>

              {/* Stamps input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Number of Savings Stamps (₹{selectedShg.stampValue} / Stamp)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={editModal.stamps}
                  onChange={(e) => {
                    const st = Math.max(0, parseInt(e.target.value) || 0);
                    setEditModal((prev) => ({
                      ...prev,
                      stamps: st,
                      depositAmount: st * selectedShg.stampValue,
                    }));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono font-bold text-sm focus:outline-none focus:border-emerald-600 focus:bg-white"
                />
              </div>

              {/* Total Deposit Amount */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Total Deposit Amount (₹)
                </label>
                <input
                  type="number"
                  step="50"
                  min="0"
                  value={editModal.depositAmount}
                  onChange={(e) =>
                    setEditModal((prev) => ({
                      ...prev,
                      depositAmount: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono font-bold text-sm focus:outline-none focus:border-emerald-600 focus:bg-white"
                />
              </div>

              {/* Loan Disbursed */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Loan Disbursed (₹)
                </label>
                <input
                  type="number"
                  step="500"
                  min="0"
                  value={editModal.loanDisbursed}
                  onChange={(e) =>
                    setEditModal((prev) => ({
                      ...prev,
                      loanDisbursed: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono font-bold text-sm focus:outline-none focus:border-emerald-600 focus:bg-white"
                />
              </div>

              {/* Re-Payment */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Re-Payment Amount (₹)
                </label>
                <input
                  type="number"
                  step="50"
                  min="0"
                  value={editModal.repayment}
                  onChange={(e) =>
                    setEditModal((prev) => ({
                      ...prev,
                      repayment: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono font-bold text-sm focus:outline-none focus:border-emerald-600 focus:bg-white"
                />
              </div>

              {/* Auto-Approve Checkbox */}
              <div className="pt-2 flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="autoApproveCheck"
                  checked={editModal.autoApprove}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, autoApprove: e.target.checked }))}
                  className="w-4 h-4 rounded text-emerald-600 cursor-pointer"
                />
                <label htmlFor="autoApproveCheck" className="text-xs font-semibold text-slate-800 cursor-pointer select-none">
                  Approve this transaction upon saving (x++)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditModal((prev) => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editModal.saving}
                onClick={handleSaveMemberEdit}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer text-xs disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{editModal.saving ? 'Saving...' : 'Save & Update'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
