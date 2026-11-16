import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Filter,
  KeyRound,
  Layers,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import type { LocationHierarchy, SHGGroup } from '../types';
import { api } from '../api/client';

interface EditableShape {
  id?: string;
  code?: string;
  name: string;
  value: number;
  color: string;
  sortOrder: number;
  isActive: boolean;
  isNew?: boolean;
}

interface GroupDetailData extends SHGGroup {
  members: {
    id: string;
    hhNo: string;
    name: string;
    husbandName?: string | null;
    mobileNo?: string | null;
    isActive?: boolean;
  }[];
  shapes: {
    id?: string;
    code: string;
    name: string;
    value: number;
    color?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  }[];
  users: {
    id: string;
    username: string;
    fullName: string;
    role: string;
    isActive: boolean;
    lastLoginAt?: string | null;
  }[];
}

interface ShgListPageProps {
  groups: SHGGroup[];
  locationHierarchy: LocationHierarchy;
  onRefresh: () => void;
  onOpenCreateModal: () => void;
}

const DEFAULT_SHAPE_COLORS = ['#0d9488', '#2563eb', '#d97706', '#7c3aed', '#ea580c', '#db2777'];

export const ShgListPage: React.FC<ShgListPageProps> = ({
  groups,
  locationHierarchy,
  onRefresh,
  onOpenCreateModal,
}) => {
  // Cascading Filter States
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedBlock, setSelectedBlock] = useState<string>('');
  const [selectedPanchayat, setSelectedPanchayat] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Drawer / Inspection State
  const [selectedGroup, setSelectedGroup] = useState<SHGGroup | null>(null);
  const [groupDetail, setGroupDetail] = useState<GroupDetailData | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Edit Configuration State inside Inspect Drawer
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editForm, setEditForm] = useState<{
    stampValue: number;
    maxStampsPerMember: number;
    maxLoanAmount: number;
    monthlyInterestPercent: string;
    repaymentRatePercent: string;
    approvalRequired: boolean;
    shapes: EditableShape[];
  }>({
    stampValue: 50,
    maxStampsPerMember: 5,
    maxLoanAmount: 50000,
    monthlyInterestPercent: '2.0',
    repaymentRatePercent: '2.0',
    approvalRequired: true,
    shapes: [],
  });

  // Cascading Options
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

  // Handle cascading filter resets
  const handleStateChange = (st: string) => {
    setSelectedState(st);
    setSelectedDistrict('');
    setSelectedBlock('');
    setSelectedPanchayat('');
  };

  const handleDistrictChange = (dst: string) => {
    setSelectedDistrict(dst);
    setSelectedBlock('');
    setSelectedPanchayat('');
  };

  const handleBlockChange = (blk: string) => {
    setSelectedBlock(blk);
    setSelectedPanchayat('');
  };

  const handleResetFilters = () => {
    setSelectedState('');
    setSelectedDistrict('');
    setSelectedBlock('');
    setSelectedPanchayat('');
    setSearchQuery('');
  };

  // Filtered List
  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      if (selectedState && g.state !== selectedState) return false;
      if (selectedDistrict && g.district !== selectedDistrict) return false;
      if (selectedBlock && g.block !== selectedBlock) return false;
      if (selectedPanchayat && g.panchayat !== selectedPanchayat) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = g.name.toLowerCase().includes(q);
        const matchesHindi = g.hindiName?.toLowerCase().includes(q);
        const matchesVillage = g.village?.toLowerCase().includes(q);
        const matchesAddress = g.address?.toLowerCase().includes(q);
        if (!matchesName && !matchesHindi && !matchesVillage && !matchesAddress) return false;
      }
      return true;
    });
  }, [groups, selectedState, selectedDistrict, selectedBlock, selectedPanchayat, searchQuery]);

  const populateEditForm = (detail: GroupDetailData) => {
    const intPct = (Number(detail.monthlyInterestRate ?? 0.02) * 100)
      .toFixed(2)
      .replace(/\.?0+$/, '');
    const repPct = (Number(detail.repaymentStampRate ?? detail.monthlyInterestRate ?? 0.02) * 100)
      .toFixed(2)
      .replace(/\.?0+$/, '');

    setEditForm({
      stampValue: Number(detail.stampValue ?? 50),
      maxStampsPerMember: Number(detail.maxStampsPerMember ?? 5),
      maxLoanAmount: Number(detail.maxLoanAmount ?? 50000),
      monthlyInterestPercent: intPct || '2',
      repaymentRatePercent: repPct || '2',
      approvalRequired: Boolean(detail.approvalRequired ?? true),
      shapes: (detail.shapes || []).map((s, idx) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        value: Number(s.value || 0),
        color: s.color || DEFAULT_SHAPE_COLORS[idx % DEFAULT_SHAPE_COLORS.length],
        sortOrder: Number(s.sortOrder ?? idx + 1),
        isActive: s.isActive !== false,
      })),
    });
  };

  // Inspect Group
  const handleInspectGroup = async (group: SHGGroup) => {
    setSelectedGroup(group);
    setGroupDetail(null);
    setDetailError(null);
    setIsEditing(false);
    setSaveMessage(null);
    setIsLoadingDetail(true);
    try {
      const detail: GroupDetailData = await api.getGroupDetail(group.id);
      setGroupDetail(detail);
      populateEditForm(detail);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load SHG details';
      setDetailError(msg);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleCloseDrawer = () => {
    if (isSaving) return;
    setSelectedGroup(null);
    setGroupDetail(null);
    setDetailError(null);
    setIsEditing(false);
    setSaveMessage(null);
  };

  const handleStartEdit = () => {
    if (!groupDetail) return;
    populateEditForm(groupDetail);
    setSaveMessage(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (isSaving) return;
    if (groupDetail) populateEditForm(groupDetail);
    setIsEditing(false);
    setSaveMessage(null);
  };

  const handleAddShape = () => {
    setEditForm((prev) => ({
      ...prev,
      shapes: [
        ...prev.shapes,
        {
          name: '',
          value: 1000,
          color: DEFAULT_SHAPE_COLORS[prev.shapes.length % DEFAULT_SHAPE_COLORS.length],
          sortOrder: prev.shapes.length + 1,
          isActive: true,
          isNew: true,
        },
      ],
    }));
  };

  const handleUpdateShape = (index: number, patch: Partial<EditableShape>) => {
    setEditForm((prev) => ({
      ...prev,
      shapes: prev.shapes.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  };

  const handleRemoveNewShape = (index: number) => {
    setEditForm((prev) => ({
      ...prev,
      shapes: prev.shapes.filter((_, i) => i !== index),
    }));
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupDetail || isSaving) return;

    const stampValue = Math.round(Number(editForm.stampValue));
    const maxStampsPerMember = Math.round(Number(editForm.maxStampsPerMember));
    const maxLoanAmount = Math.round(Number(editForm.maxLoanAmount));
    const interestPct = Number(editForm.monthlyInterestPercent);
    const repaymentPct = Number(editForm.repaymentRatePercent);

    if (!Number.isFinite(stampValue) || stampValue <= 0) {
      setSaveMessage({ type: 'error', text: 'Savings stamp value must be greater than ₹0.' });
      return;
    }
    if (!Number.isFinite(maxStampsPerMember) || maxStampsPerMember < 1) {
      setSaveMessage({ type: 'error', text: 'Max stamps per meeting must be at least 1.' });
      return;
    }
    if (!Number.isFinite(maxLoanAmount) || maxLoanAmount <= 0) {
      setSaveMessage({ type: 'error', text: 'Max loan limit must be greater than ₹0.' });
      return;
    }
    if (!Number.isFinite(interestPct) || interestPct < 0) {
      setSaveMessage({ type: 'error', text: 'Interest rate must be 0% or higher.' });
      return;
    }
    if (!Number.isFinite(repaymentPct) || repaymentPct < 0) {
      setSaveMessage({ type: 'error', text: 'Repayment stamp rate must be 0% or higher.' });
      return;
    }

    const activeShapes = editForm.shapes.filter((s) => s.isActive);
    if (editForm.shapes.length === 0 || activeShapes.length === 0) {
      setSaveMessage({ type: 'error', text: 'At least one active loan shape is required.' });
      return;
    }

    for (let i = 0; i < editForm.shapes.length; i++) {
      const s = editForm.shapes[i];
      if (!s.name.trim()) {
        setSaveMessage({ type: 'error', text: `Loan shape #${i + 1} requires a name.` });
        return;
      }
      if (!Number.isFinite(Number(s.value)) || Number(s.value) <= 0) {
        setSaveMessage({ type: 'error', text: `Loan shape "${s.name.trim()}" must have a positive ₹ value.` });
        return;
      }
    }

    setIsSaving(true);
    setSaveMessage(null);
    try {
      const payload = {
        stampValue,
        maxStampsPerMember,
        maxLoanAmount,
        monthlyInterestRate: (interestPct / 100).toFixed(4),
        repaymentStampRate: (repaymentPct / 100).toFixed(4),
        approvalRequired: editForm.approvalRequired,
        shapes: editForm.shapes.map((s, idx) => ({
          id: s.id,
          code: s.code,
          name: s.name.trim(),
          value: Math.round(Number(s.value)),
          color: s.color || '#0d9488',
          sortOrder: idx + 1,
          isActive: s.isActive,
        })),
      };

      const updated = (await api.updateGroup(groupDetail.id, payload)) as Partial<GroupDetailData>;
      const refreshedDetail: GroupDetailData = {
        ...groupDetail,
        ...updated,
        shapes: updated?.shapes || groupDetail.shapes,
      };
      setGroupDetail(refreshedDetail);
      setSelectedGroup((prev) => (prev ? { ...prev, ...updated } : prev));
      populateEditForm(refreshedDetail);
      setIsEditing(false);
      setSaveMessage({ type: 'success', text: 'SHG rules & loan shapes updated successfully.' });
      onRefresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save SHG configuration.';
      setSaveMessage({ type: 'error', text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const formatRupees = (val: number = 0) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  const formatInterestRate = (rate?: string | number | null) => {
    const pct = Number(rate ?? 0.02) * 100;
    return `${pct.toFixed(2).replace(/\.?0+$/, '')}% / mo`;
  };

  const activeFiltersCount = [selectedState, selectedDistrict, selectedBlock, selectedPanchayat, searchQuery].filter(
    Boolean,
  ).length;

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        {/* Top Action & Search Bar */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Self Help Group Directory</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing {filteredGroups.length} of {groups.length} registered SHGs
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={onRefresh}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                title="Refresh SHG Directory"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>

              {activeFiltersCount > 0 && (
                <button
                  onClick={handleResetFilters}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Filters ({activeFiltersCount})</span>
                </button>
              )}

              <button
                onClick={onOpenCreateModal}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
              >
                <Building2 className="w-4 h-4" />
                <span>Create New SHG</span>
              </button>
            </div>
          </div>

          {/* Cascading Hierarchical Search Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mt-5">
            {/* State */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                State
              </label>
              <div className="relative">
                <select
                  value={selectedState}
                  onChange={(e) => handleStateChange(e.target.value)}
                  className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-xs text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden appearance-none cursor-pointer"
                >
                  <option value="">All States ({locationHierarchy.states.length})</option>
                  {locationHierarchy.states.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>

            {/* District */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                District
              </label>
              <div className="relative">
                <select
                  value={selectedDistrict}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-xs text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden appearance-none cursor-pointer"
                >
                  <option value="">All Districts ({availableDistricts.length})</option>
                  {availableDistricts.map((dst) => (
                    <option key={dst} value={dst}>
                      {dst}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Block */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Block
              </label>
              <div className="relative">
                <select
                  value={selectedBlock}
                  onChange={(e) => handleBlockChange(e.target.value)}
                  className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-xs text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden appearance-none cursor-pointer"
                >
                  <option value="">All Blocks ({availableBlocks.length})</option>
                  {availableBlocks.map((blk) => (
                    <option key={blk} value={blk}>
                      {blk}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Panchayat */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Gram Panchayat
              </label>
              <div className="relative">
                <select
                  value={selectedPanchayat}
                  onChange={(e) => setSelectedPanchayat(e.target.value)}
                  className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-xs text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden appearance-none cursor-pointer"
                >
                  <option value="">All Panchayats ({availablePanchayats.length})</option>
                  {availablePanchayats.map((pnc) => (
                    <option key={pnc} value={pnc}>
                      {pnc}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Search Box */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Keyword Search
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search SHG or Village..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SHG Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-4 px-6">SHG Details</th>
                  <th className="py-4 px-4">Location (Hierarchy)</th>
                  <th className="py-4 px-4">Cycle & Meeting</th>
                  <th className="py-4 px-4 text-center">Members</th>
                  <th className="py-4 px-4 text-right">Total Savings</th>
                  <th className="py-4 px-4 text-right">Active Loan</th>
                  <th className="py-4 px-4">Validation & Rules</th>
                  <th className="py-4 px-6 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredGroups.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <Filter className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-600">No Self Help Groups match this location criteria</p>
                      <p className="text-xs text-slate-400 mt-1">Try resetting the district or block filter above.</p>
                    </td>
                  </tr>
                ) : (
                  filteredGroups.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* SHG Details */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 border border-emerald-200 text-xs">
                            {g.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{g.name}</div>
                            {g.hindiName && <div className="text-[11px] text-slate-500">{g.hindiName}</div>}
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {g.id.slice(0, 8)}</div>
                          </div>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-4 px-4">
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-slate-800">
                              {g.panchayat}, {g.block}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {g.district}, {g.state}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Cycle & Meeting */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                            <Layers className="w-3 h-3" />
                            Cycle {g.currentCycle?.cycleNo || 1}
                          </span>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {g.meetingDay || 'Weekly'}
                          </div>
                        </div>
                      </td>

                      {/* Members */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                          <Users className="w-3 h-3" />
                          {g.memberCount ?? 0}
                        </span>
                      </td>

                      {/* Total Savings */}
                      <td className="py-4 px-4 text-right font-bold text-slate-900">
                        {formatRupees(g.totalDeposits)}
                        <div className="text-[10px] text-slate-400 font-normal">₹{g.stampValue}/stamp</div>
                      </td>

                      {/* Active Loan */}
                      <td className="py-4 px-4 text-right">
                        <div className="font-bold text-purple-700">{formatRupees(g.activeLoanAmount)}</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          {g.activeLoanCount || 0} active loans
                        </div>
                      </td>

                      {/* Validation & Rules */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="text-[11px] text-slate-600">
                            Max: <span className="font-bold text-slate-800">{formatRupees(g.maxLoanAmount)}</span>
                          </div>
                          {g.approvalRequired ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <ShieldAlert className="w-2.5 h-2.5" /> Approval Req.
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Auto-approve
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-center">
                        <button
                          type="button"
                          onClick={() => handleInspectGroup(g)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 text-slate-700 font-semibold text-xs transition-colors border border-slate-200 cursor-pointer"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Slide-out SHG Inspection & Configuration Drawer (rendered outside .animate-fade-in so fixed positioning is viewport-relative) */}
      {selectedGroup && (
        <div
          onClick={handleCloseDrawer}
          className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-end animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-50 shrink-0">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-bold text-base flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                  {selectedGroup.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 truncate">{selectedGroup.name}</h3>
                  {selectedGroup.hindiName && (
                    <div className="text-xs text-slate-500 truncate">{selectedGroup.hindiName}</div>
                  )}
                  <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 mt-0.5 truncate">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {selectedGroup.panchayat}, {selectedGroup.block}, {selectedGroup.district}, {selectedGroup.state}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {groupDetail && !isLoadingDetail && !detailError && !isEditing && (
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit Rules & Shapes</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCloseDrawer}
                  disabled={isSaving}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {saveMessage && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                    saveMessage.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {saveMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{saveMessage.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSaveMessage(null)}
                    className="p-1 rounded hover:bg-black/5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {isLoadingDetail ? (
                <div className="py-20 text-center text-slate-400 space-y-3">
                  <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs font-semibold">Loading SHG roster and configurations...</p>
                </div>
              ) : detailError ? (
                <div className="py-12 px-6 text-center bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
                  <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
                  <div>
                    <h4 className="text-sm font-bold text-rose-900">Unable to load SHG details</h4>
                    <p className="text-xs text-rose-700 mt-1">{detailError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleInspectGroup(selectedGroup)}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : groupDetail ? (
                isEditing ? (
                  /* ==================== EDIT CONFIGURATION FORM ==================== */
                  <form id="edit-shg-config-form" onSubmit={handleSaveConfig} className="space-y-6">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        SHG Financial Rules & Limits
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Savings Stamp Value & Max Stamps */}
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                          <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Savings Stamp
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 font-semibold mb-1">
                              Stamp Value (₹ / stamp)
                            </label>
                            <input
                              type="number"
                              min={1}
                              required
                              value={editForm.stampValue}
                              onChange={(e) =>
                                setEditForm((prev) => ({ ...prev, stampValue: Number(e.target.value) }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 font-semibold mb-1">
                              Max Stamps / Meeting
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={20}
                              required
                              value={editForm.maxStampsPerMember}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  maxStampsPerMember: Number(e.target.value),
                                }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                            />
                          </div>
                        </div>

                        {/* Max Loan Limit */}
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                          <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Max Loan Limit
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 font-semibold mb-1">
                              Maximum Loan Amount (₹)
                            </label>
                            <input
                              type="number"
                              min={100}
                              step={100}
                              required
                              value={editForm.maxLoanAmount}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  maxLoanAmount: Number(e.target.value),
                                }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-xs font-bold text-purple-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                            />
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Maximum principal allowed per loan disbursement.
                          </p>
                        </div>

                        {/* Interest Rate */}
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                          <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Interest Rate
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 font-semibold mb-1">
                              Monthly Interest Rate (% / mo)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={25}
                              step={0.1}
                              required
                              value={editForm.monthlyInterestPercent}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  monthlyInterestPercent: e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-xs font-bold text-indigo-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 font-semibold mb-1">
                              Repayment Stamp Rate (% of face value)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={25}
                              step={0.1}
                              required
                              value={editForm.repaymentRatePercent}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  repaymentRatePercent: e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-xs font-bold text-indigo-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                            />
                          </div>
                        </div>

                        {/* Approvals */}
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5 flex flex-col justify-between">
                          <div className="space-y-2">
                            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                              Approvals
                            </div>
                            <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
                              <input
                                type="checkbox"
                                checked={editForm.approvalRequired}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    approvalRequired: e.target.checked,
                                  }))
                                }
                                className="w-4 h-4 mt-0.5 accent-emerald-600 rounded cursor-pointer"
                              />
                              <div>
                                <span className="text-xs font-bold text-slate-900 block">
                                  {editForm.approvalRequired ? 'Mandatory Admin Approval' : 'Auto-Approve Transactions'}
                                </span>
                                <span className="text-[11px] text-slate-500 block mt-0.5">
                                  {editForm.approvalRequired
                                    ? 'Field entries require Admin sign-off in Finance before approval.'
                                    : 'Field entries are marked approved automatically upon submission.'}
                                </span>
                              </div>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Configured Loan Shapes Editor */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Configured Loan Shapes ({editForm.shapes.length})
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Edit shape names, rupee denominations, colors, or toggle availability.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddShape}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Shape</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {editForm.shapes.map((shape, idx) => (
                          <div
                            key={shape.id || `new-${idx}`}
                            className={`bg-white p-3 rounded-xl border flex flex-wrap sm:flex-nowrap items-center gap-2.5 ${
                              shape.isActive ? 'border-slate-200' : 'border-slate-200 bg-slate-100/70 opacity-75'
                            }`}
                          >
                            <input
                              type="color"
                              value={shape.color || '#0d9488'}
                              onChange={(e) => handleUpdateShape(idx, { color: e.target.value })}
                              title="Shape color"
                              className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer shrink-0 p-0.5 bg-white"
                            />

                            <div className="flex-1 min-w-[120px]">
                              <input
                                type="text"
                                placeholder="Shape Name (e.g. Sun)"
                                value={shape.name}
                                onChange={(e) => handleUpdateShape(idx, { name: e.target.value })}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                              />
                            </div>

                            <div className="w-28 shrink-0">
                              <div className="relative">
                                <span className="absolute left-2.5 top-1.5 text-xs font-bold text-slate-400">₹</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={shape.value}
                                  onChange={(e) =>
                                    handleUpdateShape(idx, { value: Number(e.target.value) })
                                  }
                                  className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                                />
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleUpdateShape(idx, { isActive: !shape.isActive })}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer shrink-0 ${
                                shape.isActive
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300'
                              }`}
                            >
                              {shape.isActive ? 'Active' : 'Disabled'}
                            </button>

                            {shape.isNew && (
                              <button
                                type="button"
                                onClick={() => handleRemoveNewShape(idx)}
                                className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                                title="Remove shape"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </form>
                ) : (
                  /* ==================== READ-ONLY INSPECT VIEW ==================== */
                  <>
                    {/* Governance & Rules Pill Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Savings Stamp</div>
                        <div className="text-base font-bold text-slate-900 mt-0.5">₹{groupDetail.stampValue}</div>
                        <div className="text-[10px] text-slate-400">
                          Max {groupDetail.maxStampsPerMember}/meeting
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Max Loan Limit</div>
                        <div className="text-base font-bold text-purple-700 mt-0.5">
                          {formatRupees(groupDetail.maxLoanAmount)}
                        </div>
                        <div className="text-[10px] text-slate-400">Per disbursement</div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Interest Rate</div>
                        <div className="text-base font-bold text-indigo-700 mt-0.5">
                          {formatInterestRate(groupDetail.monthlyInterestRate)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Repay stamp: {formatInterestRate(groupDetail.repaymentStampRate ?? groupDetail.monthlyInterestRate).replace(' / mo', '')}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Approvals</div>
                        <div className="text-sm font-bold text-slate-900 mt-1">
                          {groupDetail.approvalRequired ? 'Mandatory' : 'Auto-approve'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {groupDetail.approvalRequired ? 'Admin signed' : 'Immediate'}
                        </div>
                      </div>
                    </div>

                    {/* Associated Operator Logins */}
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Field Operator Login Accounts</span>
                        </h4>
                        <span className="text-[10px] text-slate-400">PWA Access</span>
                      </div>

                      {!groupDetail.users || groupDetail.users.length === 0 ? (
                        <div className="p-3 bg-white rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                          No operator login account assigned to this SHG yet.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {groupDetail.users.map((u) => (
                            <div
                              key={u.id}
                              className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                                  <User className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900 text-xs truncate">{u.fullName}</div>
                                  <div className="text-[11px] text-slate-500 font-mono truncate">@{u.username}</div>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  {u.role}
                                </span>
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  {u.lastLoginAt
                                    ? `Last login: ${new Date(u.lastLoginAt).toLocaleString(undefined, {
                                        dateStyle: 'short',
                                        timeStyle: 'short',
                                      })}`
                                    : 'No login recorded'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Configured Stamp Shapes */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
                        Configured Loan Shapes
                      </h4>
                      {!groupDetail.shapes || groupDetail.shapes.length === 0 ? (
                        <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                          No loan shapes configured.
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {groupDetail.shapes.map((s) => (
                            <div
                              key={s.code}
                              className={`px-3 py-1.5 rounded-xl border bg-white shadow-2xs flex items-center gap-2 ${
                                s.isActive === false ? 'border-slate-200 opacity-50' : 'border-slate-200'
                              }`}
                            >
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: s.color || '#0d9488' }}
                              ></span>
                              <span className="text-xs font-semibold text-slate-800">{s.name}</span>
                              <span className="text-xs font-bold text-slate-900">₹{s.value}</span>
                              {s.isActive === false && (
                                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 rounded">
                                  Disabled
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Member Roster */}
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Registered Member Roster ({groupDetail.members?.length || 0})
                        </h4>
                        <span className="text-xs text-slate-500">Ordered by Household No</span>
                      </div>

                      {!groupDetail.members || groupDetail.members.length === 0 ? (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center text-xs text-amber-800 font-medium">
                          No members registered in this SHG yet.
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-xl overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                              <tr>
                                <th className="py-2.5 px-3">HH No</th>
                                <th className="py-2.5 px-3">Member Name</th>
                                <th className="py-2.5 px-3">Husband / Family</th>
                                <th className="py-2.5 px-3">Mobile</th>
                                <th className="py-2.5 px-3 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {groupDetail.members.map((m) => (
                                <tr key={m.id} className="hover:bg-slate-50/60">
                                  <td className="py-2 px-3 font-mono font-semibold text-slate-800">{m.hhNo}</td>
                                  <td className="py-2 px-3 font-medium text-slate-900">{m.name}</td>
                                  <td className="py-2 px-3 text-slate-500">{m.husbandName || '-'}</td>
                                  <td className="py-2 px-3 text-slate-500 font-mono">{m.mobileNo || '-'}</td>
                                  <td className="py-2 px-3 text-center">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                      Active
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )
              ) : null}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5 shrink-0">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleCancelEdit}
                    className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="edit-shg-config-form"
                    disabled={isSaving}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleCloseDrawer}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  Close Drawer
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
