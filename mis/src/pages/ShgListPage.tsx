import React, { useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Filter,
  KeyRound,
  Layers,
  MapPin,
  RotateCcw,
  Search,
  ShieldAlert,
  User,
  Users,
  X,
} from 'lucide-react';
import type { LocationHierarchy, SHGGroup } from '../types';
import { api } from '../api/client';

interface ShgListPageProps {
  groups: SHGGroup[];
  locationHierarchy: LocationHierarchy;
  onRefresh: () => void;
  onOpenCreateModal: () => void;
}

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
  const [groupDetail, setGroupDetail] = useState<any | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

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
    // If only district is selected
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

  // Inspect Group
  const handleInspectGroup = async (group: SHGGroup) => {
    setSelectedGroup(group);
    setIsLoadingDetail(true);
    try {
      const detail = await api.getGroupDetail(group.id);
      setGroupDetail(detail);
    } catch (e) {
      console.error('Failed to load group detail', e);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const formatRupees = (val: number = 0) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  const activeFiltersCount = [selectedState, selectedDistrict, selectedBlock, selectedPanchayat, searchQuery].filter(
    Boolean,
  ).length;

  return (
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
                Showing {filteredGroups.length} of {groups.length} registered SHGs across Bihar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
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
                        {g.memberCount || 12}
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
                        onClick={() => handleInspectGroup(g)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors border border-slate-200 cursor-pointer"
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

      {/* Slide-out SHG Inspection Drawer */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-end animate-fade-in">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-200 flex items-start justify-between bg-slate-50">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-bold text-base flex items-center justify-center shadow-md shadow-emerald-600/20">
                  {selectedGroup.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedGroup.name}</h3>
                  {selectedGroup.hindiName && (
                    <div className="text-xs text-slate-500">{selectedGroup.hindiName}</div>
                  )}
                  <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {selectedGroup.panchayat}, {selectedGroup.block}, {selectedGroup.district}, {selectedGroup.state}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedGroup(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isLoadingDetail ? (
                <div className="py-20 text-center text-slate-400 space-y-3">
                  <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs font-semibold">Loading SHG roster and configurations...</p>
                </div>
              ) : groupDetail ? (
                <>
                  {/* Governance & Rules Pill Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Savings Stamp</div>
                      <div className="text-base font-bold text-slate-900 mt-0.5">₹{groupDetail.stampValue}</div>
                      <div className="text-[10px] text-slate-400">Max {groupDetail.maxStampsPerMember}/meeting</div>
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
                      <div className="text-base font-bold text-indigo-700 mt-0.5">2.0% / mo</div>
                      <div className="text-[10px] text-slate-400">Simple interest</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Approvals</div>
                      <div className="text-sm font-bold text-slate-900 mt-1">
                        {groupDetail.approvalRequired ? 'Mandatory' : 'Exempt'}
                      </div>
                      <div className="text-[10px] text-slate-400">Admin signed</div>
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

                    <div className="space-y-2">
                      {groupDetail.users?.map((u: any) => (
                        <div
                          key={u.id}
                          className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                              <User className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 text-xs">{u.fullName}</div>
                              <div className="text-[11px] text-slate-500 font-mono">@{u.username}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              {u.role}
                            </span>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {u.lastLoginAt
                                ? `Last login: ${new Date(u.lastLoginAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}`
                                : 'No login recorded'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Configured Stamp Shapes */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
                      Configured Loan Shapes
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {groupDetail.shapes?.map((s: any) => (
                        <div
                          key={s.code}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white shadow-2xs flex items-center gap-2"
                        >
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: s.color || '#0d9488' }}
                          ></span>
                          <span className="text-xs font-semibold text-slate-800">{s.name}</span>
                          <span className="text-xs font-bold text-slate-900">₹{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Member Roster */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Registered Member Roster ({groupDetail.members?.length || 0})
                      </h4>
                      <span className="text-xs text-slate-500">Ordered by Household No</span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
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
                          {groupDetail.members?.map((m: any) => (
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
                  </div>
                </>
              ) : null}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedGroup(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
