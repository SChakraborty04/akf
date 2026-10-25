import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Users,
  Building2,
  Upload,
  UserCheck,
  Plus,
  Search,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  RefreshCw,
  X,
  HelpCircle,
  MapPin,
  Edit3,
  Trash2,
  Globe,
  Layers,
} from 'lucide-react';
import { api } from '../api/client';
import type { SHGGroup, MISUser, LocationHierarchy, MasterLocation } from '../types';

export const MasterPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'shg' | 'members' | 'excel' | 'users' | 'locations'>('shg');
  const [shgs, setShgs] = useState<SHGGroup[]>([]);
  const [users, setUsers] = useState<MISUser[]>([]);
  const [locations, setLocations] = useState<LocationHierarchy | null>(null);
  const [masterLocations, setMasterLocations] = useState<MasterLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [savingShgLocation, setSavingShgLocation] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Master Location Filter & Modal State
  const [locationSearch, setLocationSearch] = useState('');
  const [locFilterState, setLocFilterState] = useState('');
  const [locFilterDistrict, setLocFilterDistrict] = useState('');
  const [locFilterBlock, setLocFilterBlock] = useState('');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<MasterLocation | null>(null);
  const [locationForm, setLocationForm] = useState({
    state: 'Bihar',
    district: 'Patna',
    block: '',
    panchayat: '',
    village: '',
    pincode: '',
    cascadeUpdateGroups: false,
  });

  // Edit SHG Location Modal State
  const [editShgModal, setEditShgModal] = useState<{
    open: boolean;
    group: SHGGroup | null;
    state: string;
    district: string;
    block: string;
    panchayat: string;
    village: string;
    address: string;
  }>({
    open: false,
    group: null,
    state: '',
    district: '',
    block: '',
    panchayat: '',
    village: '',
    address: '',
  });

  // New SHG Form State
  const [shgForm, setShgForm] = useState({
    name: '',
    hindiName: '',
    state: 'Bihar',
    district: 'Patna',
    block: 'Phulwari Sharif',
    panchayat: 'Rampur',
    village: 'Rampur',
    address: '',
    stampValue: 50,
    maxStampsPerMember: 5,
    maxLoanAmount: 50000,
    monthlyInterestRate: '0.0200',
    repaymentStampRate: '0.0200',
    meetingDay: 'Monday',
    cycleNo: 1,
    durationWeeks: 50,
    operatorUsername: '',
    operatorPassword: '',
    operatorFullName: '',
  });

  // Member Registration State
  const [selectedShgId, setSelectedShgId] = useState<string>('');
  const [memberForm, setMemberForm] = useState({
    name: '',
    hindiName: '',
    hhNo: '',
    husbandName: '',
    mobileNo: '',
    age: 30,
    caste: 'OBC',
  });
  const [shgMembersList, setShgMembersList] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Excel Upload State
  const [excelTargetShgId, setExcelTargetShgId] = useState<string>('');
  const [excelData, setExcelData] = useState<any[]>([]);
  const [excelFileName, setExcelFileName] = useState<string>('');
  const [uploadingExcel, setUploadingExcel] = useState(false);

  // User Module State
  const [userSearch, setUserSearch] = useState('');
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState<{
    username: string;
    password: string;
    fullName: string;
    role: 'super_admin' | 'admin' | 'operator' | 'viewer';
    groupId: string;
  }>({
    username: '',
    password: '',
    fullName: '',
    role: 'operator',
    groupId: '',
  });
  const [resetPasswordModal, setResetPasswordModal] = useState<{ open: boolean; user: MISUser | null; newPass: string }>({
    open: false,
    user: null,
    newPass: '',
  });
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedShgId) {
      loadGroupMembers(selectedShgId);
    }
  }, [selectedShgId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [shgList, userList, locs, masterLocs] = await Promise.all([
        api.getGroups(),
        api.getUsers(),
        api.getLocations(),
        api.getMasterLocations(),
      ]);
      setShgs(shgList);
      setUsers(userList);
      setLocations(locs);
      setMasterLocations(masterLocs);
      if (shgList.length > 0 && !selectedShgId) {
        setSelectedShgId(shgList[0].id);
        setExcelTargetShgId(shgList[0].id);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadGroupMembers = async (groupId: string) => {
    setLoadingMembers(true);
    try {
      const detail = await api.getGroupDetail(groupId);
      setShgMembersList(detail.members || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const showNotification = (type: 'success' | 'error', msg: string) => {
    if (type === 'success') {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  // 1. Create SHG Handler
  const handleCreateShg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shgForm.name.trim()) {
      showNotification('error', 'Please enter SHG Name.');
      return;
    }
    if (!shgForm.state.trim() || !shgForm.district.trim() || !shgForm.block.trim() || !shgForm.panchayat.trim()) {
      showNotification('error', 'State, District, Block, and Panchayat are required for Geographic Hierarchy.');
      return;
    }
    if (!shgForm.operatorUsername.trim() || !shgForm.operatorPassword.trim()) {
      showNotification('error', 'Operator Username and Initial Password are required.');
      return;
    }

    try {
      setLoading(true);
      await api.createGroup({
        name: shgForm.name.trim(),
        hindiName: shgForm.hindiName?.trim() || undefined,
        state: shgForm.state.trim(),
        district: shgForm.district.trim(),
        block: shgForm.block.trim(),
        panchayat: shgForm.panchayat.trim(),
        village: shgForm.village?.trim() || undefined,
        address: shgForm.address?.trim() || undefined,
        stampValue: Number(shgForm.stampValue),
        maxStampsPerMember: Number(shgForm.maxStampsPerMember),
        maxLoanAmount: Number(shgForm.maxLoanAmount),
        monthlyInterestRate: shgForm.monthlyInterestRate,
        repaymentStampRate: shgForm.repaymentStampRate,
        meetingDay: shgForm.meetingDay,
        approvalRequired: true,
        cycleNo: Number(shgForm.cycleNo),
        durationWeeks: Number(shgForm.durationWeeks),
        operatorUsername: shgForm.operatorUsername.trim().toLowerCase(),
        operatorPassword: shgForm.operatorPassword,
        operatorFullName: shgForm.operatorFullName?.trim() || `${shgForm.name.trim()} Operator`,
        group: {
          name: shgForm.name.trim(),
          hindiName: shgForm.hindiName?.trim() || undefined,
          state: shgForm.state.trim(),
          district: shgForm.district.trim(),
          block: shgForm.block.trim(),
          panchayat: shgForm.panchayat.trim(),
          village: shgForm.village?.trim() || undefined,
          address: shgForm.address?.trim() || undefined,
          stampValue: Number(shgForm.stampValue),
          maxStampsPerMember: Number(shgForm.maxStampsPerMember),
          maxLoanAmount: Number(shgForm.maxLoanAmount),
          monthlyInterestRate: shgForm.monthlyInterestRate,
          repaymentStampRate: shgForm.repaymentStampRate,
          meetingDay: shgForm.meetingDay,
          approvalRequired: true,
        },
        cycle: {
          cycleNo: Number(shgForm.cycleNo),
          durationWeeks: Number(shgForm.durationWeeks),
        },
        operator: {
          username: shgForm.operatorUsername.trim().toLowerCase(),
          password: shgForm.operatorPassword,
          fullName: shgForm.operatorFullName?.trim() || `${shgForm.name.trim()} Operator`,
        },
      });

      showNotification('success', `SHG "${shgForm.name.trim()}" created successfully with operator credentials.`);
      // reset form
      setShgForm({
        name: '',
        hindiName: '',
        state: 'Bihar',
        district: 'Patna',
        block: 'Phulwari Sharif',
        panchayat: 'Rampur',
        village: 'Rampur',
        address: '',
        stampValue: 50,
        maxStampsPerMember: 5,
        maxLoanAmount: 50000,
        monthlyInterestRate: '0.0200',
        repaymentStampRate: '0.0200',
        meetingDay: 'Monday',
        cycleNo: 1,
        durationWeeks: 50,
        operatorUsername: '',
        operatorPassword: '',
        operatorFullName: '',
      });
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to create SHG.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Add Member Handler
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShgId) {
      showNotification('error', 'Please select an SHG group first.');
      return;
    }
    if (!memberForm.name || !memberForm.hhNo) {
      showNotification('error', 'Member name and Household No (HH No) are required.');
      return;
    }

    try {
      setLoadingMembers(true);
      await api.addMember(selectedShgId, {
        name: memberForm.name,
        hindiName: memberForm.hindiName || undefined,
        hhNo: memberForm.hhNo.trim(),
        husbandName: memberForm.husbandName || undefined,
        mobileNo: memberForm.mobileNo || undefined,
        age: Number(memberForm.age) || undefined,
        caste: memberForm.caste || undefined,
      });

      showNotification('success', `Member "${memberForm.name}" enrolled into SHG.`);
      setMemberForm({
        name: '',
        hindiName: '',
        hhNo: '',
        husbandName: '',
        mobileNo: '',
        age: 30,
        caste: 'OBC',
      });
      loadGroupMembers(selectedShgId);
      loadData(); // update member counts
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to add member.');
    } finally {
      setLoadingMembers(false);
    }
  };

  // 3. Excel Parse and Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        // Normalize rows to expected fields
        const normalized = rawJson.map((r, idx) => ({
          hhNo: String(r['HH No'] || r['hhNo'] || r['Household No'] || `HH-${100 + idx + 1}`).trim(),
          name: String(r['Name'] || r['Member Name'] || r['name'] || '').trim(),
          hindiName: String(r['Hindi Name'] || r['hindiName'] || '').trim() || undefined,
          husbandName: String(r['Husband Name'] || r['Father Name'] || r['husbandName'] || '').trim() || undefined,
          mobileNo: String(r['Mobile'] || r['Phone'] || r['mobileNo'] || '').trim() || undefined,
          age: Number(r['Age'] || r['age']) || 30,
          caste: String(r['Caste'] || r['caste'] || 'OBC').trim(),
        })).filter(r => r.name.length > 0);

        setExcelData(normalized);
        showNotification('success', `Parsed ${normalized.length} member rows from ${file.name}.`);
      } catch (err: any) {
        showNotification('error', `Failed to read spreadsheet: ${err.message}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleBulkSubmit = async () => {
    if (!excelTargetShgId) {
      showNotification('error', 'Select target SHG before uploading.');
      return;
    }
    if (excelData.length === 0) {
      showNotification('error', 'No member records found to upload.');
      return;
    }

    try {
      setUploadingExcel(true);
      const res: any = await api.bulkUploadMembers(excelTargetShgId, excelData);
      showNotification('success', `Bulk import complete: ${res?.insertedCount || excelData.length} members added.`);
      setExcelData([]);
      setExcelFileName('');
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Bulk upload failed.');
    } finally {
      setUploadingExcel(false);
    }
  };

  const downloadSampleTemplate = () => {
    const sampleRows = [
      { 'HH No': 'HH-101', 'Name': 'Sunita Devi', 'Hindi Name': 'सुनीता देवी', 'Husband Name': 'Ramesh Kumar', 'Mobile': '9876543210', 'Age': 32, 'Caste': 'OBC' },
      { 'HH No': 'HH-102', 'Name': 'Meena Kumari', 'Hindi Name': 'मीना कुमारी', 'Husband Name': 'Shambhu Nath', 'Mobile': '9876543211', 'Age': 35, 'Caste': 'EBC' },
      { 'HH No': 'HH-103', 'Name': 'Anita Sharma', 'Hindi Name': 'अनिता शर्मा', 'Husband Name': 'Rajesh Sharma', 'Mobile': '9876543212', 'Age': 28, 'Caste': 'General' },
      { 'HH No': 'HH-104', 'Name': 'Rekha Devi', 'Hindi Name': 'रेखा देवी', 'Husband Name': 'Santosh Prasad', 'Mobile': '9876543213', 'Age': 40, 'Caste': 'SC' },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Members');
    XLSX.writeFile(wb, 'shg_members_template.xlsx');
  };

  // 4. User Module Handlers
  const handleToggleLock = async (user: MISUser) => {
    try {
      const willLock = !user.isLocked;
      await api.updateUser(user.id, { isLocked: willLock, failedLoginCount: 0 });
      showNotification('success', `User "${user.username}" ${willLock ? 'locked' : 'unlocked'} successfully.`);
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Could not update lock status.');
    }
  };

  const handleToggleActive = async (user: MISUser) => {
    try {
      const willActive = !user.isActive;
      await api.updateUser(user.id, { isActive: willActive });
      showNotification('success', `User "${user.username}" ${willActive ? 'activated' : 'deactivated'}.`);
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Could not update user status.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.username || !newUserForm.password || !newUserForm.fullName) {
      showNotification('error', 'All fields are required.');
      return;
    }

    try {
      await api.createUser({
        username: newUserForm.username.trim().toLowerCase(),
        password: newUserForm.password,
        fullName: newUserForm.fullName,
        role: newUserForm.role,
        groupId: newUserForm.role === 'operator' ? newUserForm.groupId : undefined,
      });
      showNotification('success', `User account "${newUserForm.username}" created.`);
      setShowCreateUserModal(false);
      setNewUserForm({
        username: '',
        password: '',
        fullName: '',
        role: 'operator',
        groupId: '',
      });
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to create user account.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordModal.user || !resetPasswordModal.newPass) return;

    try {
      await api.resetPassword(resetPasswordModal.user.id, resetPasswordModal.newPass);
      showNotification('success', `Password for "${resetPasswordModal.user.username}" has been reset.`);
      setResetPasswordModal({ open: false, user: null, newPass: '' });
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to reset password.');
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.fullName.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      (u.groupName && u.groupName.toLowerCase().includes(q))
    );
  });

  // Location Master Handlers
  const openAddLocationModal = () => {
    setEditingLocation(null);
    setLocationForm({
      state: 'Bihar',
      district: 'Patna',
      block: '',
      panchayat: '',
      village: '',
      pincode: '',
      cascadeUpdateGroups: false,
    });
    setShowLocationModal(true);
  };

  const openEditLocationModal = (loc: MasterLocation) => {
    setEditingLocation(loc);
    setLocationForm({
      state: loc.state,
      district: loc.district,
      block: loc.block,
      panchayat: loc.panchayat,
      village: loc.village,
      pincode: loc.pincode || '',
      cascadeUpdateGroups: false,
    });
    setShowLocationModal(true);
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !locationForm.state.trim() ||
      !locationForm.district.trim() ||
      !locationForm.block.trim() ||
      !locationForm.panchayat.trim() ||
      !locationForm.village.trim()
    ) {
      showNotification('error', 'State, District, Block, Panchayat, and Village are required.');
      return;
    }

    try {
      setSavingLocation(true);
      if (editingLocation) {
        await api.updateMasterLocation(editingLocation.id, {
          state: locationForm.state.trim(),
          district: locationForm.district.trim(),
          block: locationForm.block.trim(),
          panchayat: locationForm.panchayat.trim(),
          village: locationForm.village.trim(),
          pincode: locationForm.pincode.trim() || undefined,
          cascadeUpdateGroups: locationForm.cascadeUpdateGroups,
        });
        showNotification('success', `Location "${locationForm.village}, ${locationForm.panchayat}" updated successfully.`);
      } else {
        await api.createMasterLocation({
          state: locationForm.state.trim(),
          district: locationForm.district.trim(),
          block: locationForm.block.trim(),
          panchayat: locationForm.panchayat.trim(),
          village: locationForm.village.trim(),
          pincode: locationForm.pincode.trim() || undefined,
        });
        showNotification('success', `Master location "${locationForm.village}, ${locationForm.panchayat}" added successfully.`);
      }
      setShowLocationModal(false);
      setEditingLocation(null);
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to save location.');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleDeleteLocation = async (loc: MasterLocation) => {
    if (!confirm(`Are you sure you want to delete or deactivate location: "${loc.village}, ${loc.panchayat}, ${loc.block}"?`)) {
      return;
    }
    try {
      const res = await api.deleteMasterLocation(loc.id);
      if (res?.note) {
        showNotification('success', res.note);
      } else {
        showNotification('success', `Location "${loc.village}" deleted.`);
      }
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to delete location.');
    }
  };

  const handleToggleLocationActive = async (loc: MasterLocation) => {
    try {
      await api.updateMasterLocation(loc.id, { isActive: !loc.isActive });
      showNotification('success', `Location "${loc.village}" marked as ${!loc.isActive ? 'active' : 'inactive'}.`);
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update location status.');
    }
  };

  // SHG Location Edit Handlers
  const openEditShgModal = (g: SHGGroup) => {
    setEditShgModal({
      open: true,
      group: g,
      state: g.state || 'Bihar',
      district: g.district || 'Patna',
      block: g.block || '',
      panchayat: g.panchayat || '',
      village: g.village || '',
      address: g.address || '',
    });
  };

  const handleSaveShgLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editShgModal.group) return;
    try {
      setSavingShgLocation(true);
      await api.updateGroup(editShgModal.group.id, {
        state: editShgModal.state.trim(),
        district: editShgModal.district.trim(),
        block: editShgModal.block.trim(),
        panchayat: editShgModal.panchayat.trim(),
        village: editShgModal.village.trim() || editShgModal.panchayat.trim(),
        address: editShgModal.address.trim() || undefined,
      });
      showNotification('success', `Location for SHG "${editShgModal.group.name}" updated successfully.`);
      setEditShgModal({ open: false, group: null, state: '', district: '', block: '', panchayat: '', village: '', address: '' });
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update SHG location.');
    } finally {
      setSavingShgLocation(false);
    }
  };

  // Filtered master locations
  const filteredMasterLocations = useMemo(() => {
    return masterLocations.filter((loc) => {
      if (locFilterState && loc.state !== locFilterState) return false;
      if (locFilterDistrict && loc.district !== locFilterDistrict) return false;
      if (locFilterBlock && loc.block !== locFilterBlock) return false;
      if (locationSearch.trim()) {
        const q = locationSearch.toLowerCase();
        const matchState = loc.state.toLowerCase().includes(q);
        const matchDistrict = loc.district.toLowerCase().includes(q);
        const matchBlock = loc.block.toLowerCase().includes(q);
        const matchPanchayat = loc.panchayat.toLowerCase().includes(q);
        const matchVillage = loc.village.toLowerCase().includes(q);
        const matchPincode = loc.pincode?.toLowerCase().includes(q);
        if (!matchState && !matchDistrict && !matchBlock && !matchPanchayat && !matchVillage && !matchPincode) {
          return false;
        }
      }
      return true;
    });
  }, [masterLocations, locFilterState, locFilterDistrict, locFilterBlock, locationSearch]);

  const uniqueStatesCount = useMemo(() => new Set(masterLocations.map((l) => l.state)).size, [masterLocations]);
  const uniqueDistrictsCount = useMemo(() => new Set(masterLocations.map((l) => `${l.state}-${l.district}`)).size, [masterLocations]);
  const uniqueBlocksCount = useMemo(() => new Set(masterLocations.map((l) => `${l.district}-${l.block}`)).size, [masterLocations]);
  const uniquePanchayatsCount = useMemo(() => new Set(masterLocations.map((l) => `${l.block}-${l.panchayat}`)).size, [masterLocations]);


  return (
    <div className="space-y-6">
      {/* Toast Messages */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-between text-sm shadow-lg backdrop-blur-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center justify-between text-sm shadow-lg backdrop-blur-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-indigo-400" />
            Master Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Provision new Self Help Groups, onboard members, bulk import spreadsheets, and manage user accounts.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/70 text-sm font-medium transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('shg')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
            activeTab === 'shg'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Building2 className="w-4 h-4" />
          SHG Master (New SHG)
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
            activeTab === 'members'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          Member Registration
        </button>

        <button
          onClick={() => setActiveTab('excel')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
            activeTab === 'excel'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Excel Upload (Bulk Import)
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
            activeTab === 'users'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          User Module
          <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('locations')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
            activeTab === 'locations'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <MapPin className="w-4 h-4" />
          Location Master
          <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
            {masterLocations.length}
          </span>
        </button>
      </div>

      {/* TAB 1: SHG Master (Create SHG with Operator Credentials) */}
      {activeTab === 'shg' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleCreateShg} className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-400" />
                  Register New Self Help Group (SHG)
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Creates the SHG, initializes Cycle 1, seeds default loan stamp shapes, and automatically provisions the field operator account.
                </p>
              </div>

              {/* Group Core Info */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400">1. Basic Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      SHG Name (English) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mahila Pragati SHG"
                      value={shgForm.name}
                      onChange={(e) => setShgForm({ ...shgForm, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Local / Hindi Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. महिला प्रगति स्वयं सहायता समूह"
                      value={shgForm.hindiName}
                      onChange={(e) => setShgForm({ ...shgForm, hindiName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Weekly Meeting Day</label>
                    <select
                      value={shgForm.meetingDay}
                      onChange={(e) => setShgForm({ ...shgForm, meetingDay: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition"
                    >
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => (
                        <option key={d} value={d} className="bg-slate-900">{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Stamp Value (₹)</label>
                    <input
                      type="number"
                      min="10"
                      step="10"
                      value={shgForm.stampValue}
                      onChange={(e) => setShgForm({ ...shgForm, stampValue: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Max Loan Cap (₹)</label>
                    <input
                      type="number"
                      min="5000"
                      step="5000"
                      value={shgForm.maxLoanAmount}
                      onChange={(e) => setShgForm({ ...shgForm, maxLoanAmount: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Geographic Hierarchy */}
              <div className="space-y-4 pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400">2. Geographic Hierarchy</h3>
                  <span className="text-[11px] text-slate-400">Cascading administrative hierarchy</span>
                </div>

                {/* Datalists for quick location selection */}
                <datalist id="shg-states">
                  {locations?.states?.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <datalist id="shg-districts">
                  {locations?.districts?.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
                <datalist id="shg-blocks">
                  {locations?.blocks?.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
                <datalist id="shg-panchayats">
                  {locations?.panchayats?.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      State <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      list="shg-states"
                      placeholder="e.g. Bihar"
                      value={shgForm.state}
                      onChange={(e) => setShgForm({ ...shgForm, state: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      District <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      list="shg-districts"
                      placeholder="e.g. Patna"
                      value={shgForm.district}
                      onChange={(e) => setShgForm({ ...shgForm, district: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Block <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      list="shg-blocks"
                      placeholder="e.g. Phulwari Sharif / Danapur"
                      value={shgForm.block}
                      onChange={(e) => setShgForm({ ...shgForm, block: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Panchayat <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      list="shg-panchayats"
                      placeholder="e.g. Rampur / Saguna"
                      value={shgForm.panchayat}
                      onChange={(e) => setShgForm({ ...shgForm, panchayat: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Village / Hamlet</label>
                    <input
                      type="text"
                      placeholder="e.g. Saguna More, Ward 2"
                      value={shgForm.village}
                      onChange={(e) => setShgForm({ ...shgForm, village: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Full Address Line</label>
                    <input
                      type="text"
                      placeholder="e.g. Near Community Center, Ward No. 2"
                      value={shgForm.address}
                      onChange={(e) => setShgForm({ ...shgForm, address: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Operator Credentials (Requirement: Create a new SHG with username and password) */}
              <div className="space-y-4 pt-2 border-t border-slate-800/80 bg-slate-950/40 p-4 rounded-xl border border-indigo-500/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-indigo-400" />
                    3. Field Operator Login Credentials (PWA Access)
                  </h3>
                  <span className="text-[11px] text-indigo-300/80 font-mono">Role: Operator</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Operator Username <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. pragati_op"
                      value={shgForm.operatorUsername}
                      onChange={(e) => setShgForm({ ...shgForm, operatorUsername: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Initial Password <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'}
                        required
                        placeholder="Min 6 characters"
                        value={shgForm.operatorPassword}
                        onChange={(e) => setShgForm({ ...shgForm, operatorPassword: e.target.value })}
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Operator Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Kumar (Secretary)"
                      value={shgForm.operatorFullName}
                      onChange={(e) => setShgForm({ ...shgForm, operatorFullName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm shadow-lg shadow-indigo-600/25 transition disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  {loading ? 'Creating Group...' : 'Create SHG & Provision Operator'}
                </button>
              </div>
            </form>
          </div>

          {/* Quick Guide / Info */}
          <div className="space-y-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-indigo-400" />
                SHG Creation Workflow
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                When you create a Self Help Group via the MIS Master, the system executes the following steps in one atomic transaction:
              </p>
              <ul className="text-xs text-slate-300 space-y-2 list-disc pl-4">
                <li>Allocates unique Group ID with location metadata.</li>
                <li>Initializes Cycle 1 with weekly meeting frequency and passbook shapes.</li>
                <li>Creates the Operator user account linked to the group.</li>
                <li>Operator can immediately log in to the PWA app to record weekly savings and loans.</li>
              </ul>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-200">Active SHGs ({shgs.length})</h3>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {shgs.map((g) => (
                  <div key={g.id} className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-200">{g.name}</p>
                      <p className="text-slate-400 text-[11px]">
                        {g.village ? `${g.village}, ` : ''}{g.panchayat || ''}, {g.block || ''}, {g.district}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 font-mono text-[11px]">
                        {g.memberCount} members
                      </span>
                      <button
                        type="button"
                        onClick={() => openEditShgModal(g)}
                        title="Edit SHG Location Details"
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-indigo-300 transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Member Registration */}
      {activeTab === 'members' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <form onSubmit={handleAddMember} className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  Individual Member Registration
                </h2>
                <p className="text-xs text-slate-400 mt-1">Enroll a new member into an existing SHG.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Target SHG Group</label>
                <select
                  value={selectedShgId}
                  onChange={(e) => setSelectedShgId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                >
                  {shgs.map((g) => (
                    <option key={g.id} value={g.id} className="bg-slate-900">
                      {g.name} ({g.district})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Household / Passbook No (HH No) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HH-115"
                  value={memberForm.hhNo}
                  onChange={(e) => setMemberForm({ ...memberForm, hhNo: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Member Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kavita Devi"
                  value={memberForm.name}
                  onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Local / Hindi Name</label>
                <input
                  type="text"
                  placeholder="e.g. कविता देवी"
                  value={memberForm.hindiName}
                  onChange={(e) => setMemberForm({ ...memberForm, hindiName: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Husband / Father's Name</label>
                <input
                  type="text"
                  placeholder="e.g. Manoj Kumar"
                  value={memberForm.husbandName}
                  onChange={(e) => setMemberForm({ ...memberForm, husbandName: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Mobile No</label>
                  <input
                    type="tel"
                    placeholder="10 digits"
                    value={memberForm.mobileNo}
                    onChange={(e) => setMemberForm({ ...memberForm, mobileNo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Age</label>
                  <input
                    type="number"
                    min="18"
                    max="90"
                    value={memberForm.age}
                    onChange={(e) => setMemberForm({ ...memberForm, age: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Social Category / Caste</label>
                <select
                  value={memberForm.caste}
                  onChange={(e) => setMemberForm({ ...memberForm, caste: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="OBC">OBC (Other Backward Class)</option>
                  <option value="EBC">EBC (Economically Backward Class)</option>
                  <option value="SC">SC (Scheduled Caste)</option>
                  <option value="ST">ST (Scheduled Tribe)</option>
                  <option value="General">General</option>
                  <option value="Minority">Minority</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loadingMembers}
                className="w-full mt-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm shadow-lg shadow-indigo-600/25 transition disabled:opacity-50"
              >
                {loadingMembers ? 'Enrolling...' : 'Enroll Member'}
              </button>
            </form>
          </div>

          {/* Members Table */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
                <div>
                  <h3 className="text-base font-semibold text-slate-100">
                    Enrolled Members ({shgMembersList.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Currently viewing members in: <span className="text-indigo-400 font-medium">{shgs.find(g => g.id === selectedShgId)?.name || 'Selected SHG'}</span>
                  </p>
                </div>
                <button
                  onClick={() => selectedShgId && loadGroupMembers(selectedShgId)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 self-end sm:self-auto"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingMembers ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {shgMembersList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  No members registered in this SHG yet. Use the form on the left or upload an Excel sheet.
                </div>
              ) : (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">HH No</th>
                        <th className="pb-3 font-semibold">Name</th>
                        <th className="pb-3 font-semibold">Husband / Father</th>
                        <th className="pb-3 font-semibold">Mobile</th>
                        <th className="pb-3 font-semibold">Category</th>
                        <th className="pb-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {shgMembersList.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 font-mono font-bold text-indigo-400">{m.hhNo}</td>
                          <td className="py-3 font-medium text-slate-200">
                            <div>{m.name}</div>
                            {m.hindiName && <div className="text-[11px] text-slate-400">{m.hindiName}</div>}
                          </td>
                          <td className="py-3 text-slate-300">{m.husbandName || '—'}</td>
                          <td className="py-3 font-mono text-slate-300">{m.mobileNo || '—'}</td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px]">
                              {m.caste || 'OBC'}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-medium">
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
          </div>
        </div>
      )}

      {/* TAB 3: Excel Upload (Bulk Import) */}
      {activeTab === 'excel' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                  Excel / CSV Bulk Member Onboarding
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Upload an Excel workbook (.xlsx, .xls) or CSV file with member details to batch enroll up to 50 members at once.
                </p>
              </div>

              <button
                type="button"
                onClick={downloadSampleTemplate}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700/80 transition shrink-0"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                Download Sample Excel (.xlsx)
              </button>
            </div>

            {/* Target Group Selector & File Picker */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Select Target SHG Group <span className="text-rose-400">*</span>
                </label>
                <select
                  value={excelTargetShgId}
                  onChange={(e) => setExcelTargetShgId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                >
                  {shgs.map((g) => (
                    <option key={g.id} value={g.id} className="bg-slate-900">
                      {g.name} — {g.district} ({g.memberCount} existing members)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Choose Excel / CSV File
                </label>
                <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-dashed border-indigo-500/50 text-indigo-300 text-sm font-medium cursor-pointer transition">
                  <Upload className="w-4 h-4" />
                  {excelFileName ? excelFileName : 'Click to select spreadsheet'}
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Preview Section */}
            {excelData.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-200">
                      Preview Parsed Records ({excelData.length})
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
                      Ready to import
                    </span>
                  </div>
                  <button
                    onClick={handleBulkSubmit}
                    disabled={uploadingExcel}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/25 transition disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {uploadingExcel ? 'Importing Records...' : `Import ${excelData.length} Members to SHG`}
                  </button>
                </div>

                <div className="overflow-x-auto max-h-96 rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs bg-slate-950/40">
                    <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">HH No</th>
                        <th className="p-3">Name</th>
                        <th className="p-3">Hindi Name</th>
                        <th className="p-3">Husband / Father</th>
                        <th className="p-3">Mobile</th>
                        <th className="p-3">Age</th>
                        <th className="p-3">Caste</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 text-slate-300">
                      {excelData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="p-3 text-slate-500">{idx + 1}</td>
                          <td className="p-3 font-mono font-semibold text-indigo-400">{row.hhNo}</td>
                          <td className="p-3 font-medium text-slate-100">{row.name}</td>
                          <td className="p-3 text-slate-400">{row.hindiName || '—'}</td>
                          <td className="p-3">{row.husbandName || '—'}</td>
                          <td className="p-3 font-mono">{row.mobileNo || '—'}</td>
                          <td className="p-3">{row.age}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                              {row.caste}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: User Module */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-indigo-400" />
                  User Access & Security Management
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Manage Super Admins, Regional Admins, Field Operators, and Viewers. Control account lockouts, passwords, and group access.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setNewUserForm({
                      username: '',
                      password: '',
                      fullName: '',
                      role: 'admin',
                      groupId: '',
                    });
                    setShowCreateUserModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold transition shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Admin User
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewUserForm({
                      username: '',
                      password: '',
                      fullName: '',
                      role: 'operator',
                      groupId: '',
                    });
                    setShowCreateUserModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Create New User
                </button>
              </div>
            </div>

            {/* Filter Search */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by username, full name, role, or group..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <span className="text-xs text-slate-400">Showing {filteredUsers.length} users</span>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="p-3.5 font-semibold">User Details</th>
                    <th className="p-3.5 font-semibold">Role</th>
                    <th className="p-3.5 font-semibold">Assigned SHG</th>
                    <th className="p-3.5 font-semibold">Status & Lock</th>
                    <th className="p-3.5 font-semibold">Last Login</th>
                    <th className="p-3.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.map((u) => {
                    const roleColors: Record<string, string> = {
                      super_admin: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
                      admin: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
                      operator: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
                      viewer: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
                    };

                    return (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3.5">
                          <p className="font-semibold text-slate-100">{u.fullName}</p>
                          <p className="font-mono text-slate-400 text-[11px]">@{u.username}</p>
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                              roleColors[u.role] || 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {u.role.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>

                        <td className="p-3.5 text-slate-300">
                          {u.groupName ? (
                            <span className="font-medium text-slate-200">{u.groupName}</span>
                          ) : (
                            <span className="text-slate-500 italic">All Groups (Global)</span>
                          )}
                        </td>

                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            {u.isLocked ? (
                              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-semibold flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Locked
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
                                <Unlock className="w-3 h-3" /> Normal
                              </span>
                            )}
                            {!u.isActive && (
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                                Inactive
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-3.5 text-[11px]">
                          {u.lastLoginAt ? (
                            <span className="text-emerald-400 font-medium font-mono">
                              {new Date(u.lastLoginAt).toLocaleString(undefined, {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">Never</span>
                          )}
                        </td>

                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {u.isLocked ? (
                              <button
                                onClick={() => handleToggleLock(u)}
                                title="Unlock Account"
                                className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition"
                              >
                                <Unlock className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleLock(u)}
                                title="Lock Account"
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => setResetPasswordModal({ open: true, user: u, newPass: '' })}
                              title="Reset Password"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/30 text-indigo-400 transition"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleToggleActive(u)}
                              title={u.isActive ? 'Deactivate User' : 'Activate User'}
                              className={`p-1.5 rounded-lg text-xs font-semibold ${
                                u.isActive
                                  ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25'
                                  : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                              }`}
                            >
                              {u.isActive ? 'Disable' : 'Enable'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Location Master (State, District, Block, Panchayat, Village) */}
      {activeTab === 'locations' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Header & Stats Banner */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-indigo-400" />
                  Geographic Location Master Data
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Add, update, or edit administrative hierarchy records (State, District, Block, Panchayat, Village) used for SHG provisioning, filtering, and reporting.
                </p>
              </div>

              <button
                onClick={openAddLocationModal}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/25 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Master Location
              </button>
            </div>

            {/* Geographic KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">States Covered</span>
                  <Globe className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-2xl font-bold text-slate-100 mt-1.5 font-mono">{uniqueStatesCount}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Authoritative Coverage</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Active Districts</span>
                  <Building2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-emerald-400 mt-1.5 font-mono">{uniqueDistrictsCount}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Patna, Nalanda, Gaya...</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Total Blocks</span>
                  <Layers className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-amber-400 mt-1.5 font-mono">{uniqueBlocksCount}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Administrative zones</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Villages / Hamlets</span>
                  <MapPin className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-purple-400 mt-1.5 font-mono">{masterLocations.length}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{uniquePanchayatsCount} Panchayats</div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row gap-3 pt-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search village, panchayat, block, district, pincode..."
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              {/* State Filter */}
              <select
                value={locFilterState}
                onChange={(e) => setLocFilterState(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="">All States</option>
                {[...new Set(masterLocations.map((l) => l.state))].sort().map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>

              {/* District Filter */}
              <select
                value={locFilterDistrict}
                onChange={(e) => setLocFilterDistrict(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Districts</option>
                {[...new Set(masterLocations.map((l) => l.district))].sort().map((dst) => (
                  <option key={dst} value={dst}>{dst}</option>
                ))}
              </select>

              {/* Block Filter */}
              <select
                value={locFilterBlock}
                onChange={(e) => setLocFilterBlock(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Blocks</option>
                {[...new Set(masterLocations.map((l) => l.block))].sort().map((blk) => (
                  <option key={blk} value={blk}>{blk}</option>
                ))}
              </select>

              {(locationSearch || locFilterState || locFilterDistrict || locFilterBlock) && (
                <button
                  onClick={() => {
                    setLocationSearch('');
                    setLocFilterState('');
                    setLocFilterDistrict('');
                    setLocFilterBlock('');
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Locations Master Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="p-3.5 font-semibold">State / District</th>
                    <th className="p-3.5 font-semibold">Block / Sub-District</th>
                    <th className="p-3.5 font-semibold">Gram Panchayat</th>
                    <th className="p-3.5 font-semibold">Village / Hamlet</th>
                    <th className="p-3.5 font-semibold">Postal Code</th>
                    <th className="p-3.5 font-semibold text-center">Active SHGs</th>
                    <th className="p-3.5 font-semibold text-center">Status</th>
                    <th className="p-3.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredMasterLocations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        No master locations found matching your filter criteria. Click "+ Add Master Location" to register one.
                      </td>
                    </tr>
                  ) : (
                    filteredMasterLocations.map((loc) => (
                      <tr key={loc.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3.5">
                          <p className="font-semibold text-slate-100">{loc.district}</p>
                          <p className="text-slate-400 text-[11px]">{loc.state}</p>
                        </td>

                        <td className="p-3.5">
                          <span className="font-medium text-slate-200">{loc.block}</span>
                        </td>

                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                            {loc.panchayat}
                          </span>
                        </td>

                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span className="font-bold text-slate-100">{loc.village}</span>
                          </div>
                        </td>

                        <td className="p-3.5 text-slate-300 font-mono text-[11px]">
                          {loc.pincode || '-'}
                        </td>

                        <td className="p-3.5 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                            <Building2 className="w-3 h-3" />
                            {loc.linkedGroupCount || 0} SHGs
                          </span>
                        </td>

                        <td className="p-3.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              loc.isActive
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {loc.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEditLocationModal(loc)}
                              title="Edit Location"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-indigo-400 transition"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleToggleLocationActive(loc)}
                              title={loc.isActive ? 'Deactivate Location' : 'Activate Location'}
                              className={`p-1.5 rounded-lg text-xs font-semibold ${
                                loc.isActive
                                  ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                                  : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                              }`}
                            >
                              {loc.isActive ? 'Disable' : 'Enable'}
                            </button>

                            <button
                              onClick={() => handleDeleteLocation(loc)}
                              title="Delete Location"
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT MASTER LOCATION MODAL */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-400" />
                {editingLocation ? 'Edit Master Location' : 'Add New Master Location'}
              </h3>
              <button
                onClick={() => setShowLocationModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLocation} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">State *</label>
                  <input
                    type="text"
                    required
                    list="shg-states"
                    placeholder="e.g. Bihar"
                    value={locationForm.state}
                    onChange={(e) => setLocationForm({ ...locationForm, state: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">District *</label>
                  <input
                    type="text"
                    required
                    list="shg-districts"
                    placeholder="e.g. Patna"
                    value={locationForm.district}
                    onChange={(e) => setLocationForm({ ...locationForm, district: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Block / Sub-District *</label>
                  <input
                    type="text"
                    required
                    list="shg-blocks"
                    placeholder="e.g. Phulwari Sharif"
                    value={locationForm.block}
                    onChange={(e) => setLocationForm({ ...locationForm, block: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Gram Panchayat *</label>
                  <input
                    type="text"
                    required
                    list="shg-panchayats"
                    placeholder="e.g. Rampur"
                    value={locationForm.panchayat}
                    onChange={(e) => setLocationForm({ ...locationForm, panchayat: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Village / Hamlet *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rampur / Korji"
                    value={locationForm.village}
                    onChange={(e) => setLocationForm({ ...locationForm, village: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Postal Code / PIN</label>
                  <input
                    type="text"
                    placeholder="e.g. 801505"
                    value={locationForm.pincode}
                    onChange={(e) => setLocationForm({ ...locationForm, pincode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              {editingLocation && (
                <div className="pt-2 border-t border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={locationForm.cascadeUpdateGroups}
                      onChange={(e) => setLocationForm({ ...locationForm, cascadeUpdateGroups: e.target.checked })}
                      className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-300 text-xs">
                      Cascade update registered SHGs that match "{editingLocation.panchayat}, {editingLocation.block}"
                    </span>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowLocationModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLocation}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/25 transition disabled:opacity-50"
                >
                  {savingLocation ? 'Saving...' : editingLocation ? 'Update Location' : 'Save Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SHG LOCATION MODAL */}
      {editShgModal.open && editShgModal.group && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-400" />
                  Edit SHG Geographic Location
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{editShgModal.group.name}</p>
              </div>
              <button
                onClick={() => setEditShgModal({ ...editShgModal, open: false })}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveShgLocation} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">State *</label>
                  <input
                    type="text"
                    required
                    list="shg-states"
                    value={editShgModal.state}
                    onChange={(e) => setEditShgModal({ ...editShgModal, state: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">District *</label>
                  <input
                    type="text"
                    required
                    list="shg-districts"
                    value={editShgModal.district}
                    onChange={(e) => setEditShgModal({ ...editShgModal, district: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Block *</label>
                  <input
                    type="text"
                    required
                    list="shg-blocks"
                    value={editShgModal.block}
                    onChange={(e) => setEditShgModal({ ...editShgModal, block: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Gram Panchayat *</label>
                  <input
                    type="text"
                    required
                    list="shg-panchayats"
                    value={editShgModal.panchayat}
                    onChange={(e) => setEditShgModal({ ...editShgModal, panchayat: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Village / Hamlet *</label>
                  <input
                    type="text"
                    required
                    value={editShgModal.village}
                    onChange={(e) => setEditShgModal({ ...editShgModal, village: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Full Address Line</label>
                  <input
                    type="text"
                    value={editShgModal.address}
                    onChange={(e) => setEditShgModal({ ...editShgModal, address: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditShgModal({ ...editShgModal, open: false })}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingShgLocation}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/25 transition disabled:opacity-50"
                >
                  {savingShgLocation ? 'Saving...' : 'Update SHG Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                Create MIS User
              </h3>
              <button
                onClick={() => setShowCreateUserModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Username *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. patna_auditor"
                  value={newUserForm.username}
                  onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priya Sharma"
                  value={newUserForm.fullName}
                  onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">System Role *</label>
                <select
                  value={newUserForm.role}
                  onChange={(e: any) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="super_admin">Super Administrator (Full System Control)</option>
                  <option value="admin">Regional Administrator (Approvals & Oversight)</option>
                  <option value="operator">Operator (Field App Recording)</option>
                  <option value="viewer">Viewer (Read-only Passbooks & Ledger)</option>
                </select>
              </div>

              {newUserForm.role === 'operator' && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Assign to SHG *</label>
                  <select
                    value={newUserForm.groupId}
                    onChange={(e) => setNewUserForm({ ...newUserForm, groupId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Choose SHG --</option>
                    {shgs.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.district})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/25 transition"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetPasswordModal.open && resetPasswordModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                Reset Password
              </h3>
              <button
                onClick={() => setResetPasswordModal({ open: false, user: null, newPass: '' })}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
              <p className="text-slate-400">
                Set a new password for <span className="font-semibold text-slate-200">@{resetPasswordModal.user.username}</span> ({resetPasswordModal.user.fullName}).
              </p>

              <div>
                <label className="block text-slate-300 font-medium mb-1">New Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={resetPasswordModal.newPass}
                  onChange={(e) => setResetPasswordModal({ ...resetPasswordModal, newPass: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordModal({ open: false, user: null, newPass: '' })}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/25 transition"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
