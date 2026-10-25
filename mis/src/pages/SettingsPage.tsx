import React, { useState, useEffect } from 'react';
import {
  Settings,
  ShieldCheck,
  Percent,
  SlidersHorizontal,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  Info,
  DollarSign,
  Lock,
} from 'lucide-react';
import { api } from '../api/client';
import type { SystemSettingsData } from '../types';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'access' | 'interest' | 'validation'>('access');
  const [_settings, setSettings] = useState<SystemSettingsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [formState, setFormState] = useState({
    // Interest
    monthlyInterestRate: '0.0200',
    repaymentStampRate: '0.0200',
    gracePeriodDays: 7,
    penaltyInterestRate: '0.0100',

    // Validation Rules
    maxLoanAmount: 50000,
    defaultStampValue: 50,
    maxStampsPerMeeting: 5,
    requireApproval: true,
    maxActiveLoansPerMember: 1,
    minCycleWeeks: 50,

    // Access Control
    allowViewerExport: true,
    enforcePasswordExpiry: false,
    requireTwoFactorForAdmins: false,
    restrictMultipleLogins: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setSettings(data);

      setFormState((prev) => ({
        ...prev,
        monthlyInterestRate: data.rateOfInterest.monthlyRate || '0.0200',
        maxLoanAmount: data.validationRules.maxLoanAmount || 50000,
        defaultStampValue: data.validationRules.defaultStampValue || 50,
        maxStampsPerMeeting: data.validationRules.maxStampsPerMeeting || 5,
        requireApproval: data.validationRules.requireApproval !== false,
        allowViewerExport: data.accessControl.allowViewerExport !== false,
        enforcePasswordExpiry: data.accessControl.enforcePasswordExpiry || false,
      }));
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
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

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSettings({
        'rule.rateOfInterest': JSON.stringify({
          monthlyRate: formState.monthlyInterestRate,
          percentage: `${(parseFloat(formState.monthlyInterestRate) * 100).toFixed(1)}%`,
          annualRate: `${(parseFloat(formState.monthlyInterestRate) * 12 * 100).toFixed(1)}%`,
          description: 'Simple interest calculated monthly on principal balance',
        }),
        'rule.validation': JSON.stringify({
          defaultStampValue: formState.defaultStampValue,
          maxLoanAmount: formState.maxLoanAmount,
          maxStampsPerMeeting: formState.maxStampsPerMeeting,
          requireApproval: formState.requireApproval,
          maxActiveLoansPerMember: formState.maxActiveLoansPerMember,
          minCycleWeeks: formState.minCycleWeeks,
          description: 'Global threshold defaults applied to newly registered and active SHGs',
        }),
        'rule.accessControl': JSON.stringify({
          allowViewerExport: formState.allowViewerExport,
          enforcePasswordExpiry: formState.enforcePasswordExpiry,
          requireTwoFactorForAdmins: formState.requireTwoFactorForAdmins,
          restrictMultipleLogins: formState.restrictMultipleLogins,
        }),
      });

      showNotification('success', 'System configurations and validation rules updated successfully.');
      loadSettings();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update system settings.');
    } finally {
      setSaving(false);
    }
  };

  // Interest simulation helper
  const parsedMonthlyRate = parseFloat(formState.monthlyInterestRate) || 0.02;
  const sampleLoan = 20000;
  const monthlyIntAmount = Math.round(sampleLoan * parsedMonthlyRate);
  const annualRatePercent = (parsedMonthlyRate * 12 * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <Settings className="w-7 h-7 text-indigo-400" />
            System Control & Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Global governance controls for Access Permissions, Interest Rate calculations, and Loan Validation rules.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadSettings}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/70 text-sm font-medium transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving Changes...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('access')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
            activeTab === 'access'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Access Control (RBAC)
        </button>

        <button
          onClick={() => setActiveTab('interest')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
            activeTab === 'interest'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Percent className="w-4 h-4" />
          Rate of Interest
        </button>

        <button
          onClick={() => setActiveTab('validation')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
            activeTab === 'validation'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Validation Rules
        </button>
      </div>

      {/* TAB 1: ACCESS CONTROL */}
      {activeTab === 'access' && (
        <div className="space-y-6">
          {/* Permission Matrix */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                Role-Based Access Control (RBAC) Matrix
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Defines explicit permissions for Super Admins, Regional Admins, Field Operators, and Viewers.
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="p-3.5 font-semibold">Role Name</th>
                    <th className="p-3.5 font-semibold">Description</th>
                    <th className="p-3.5 font-semibold text-center">Approve Transactions</th>
                    <th className="p-3.5 font-semibold text-center">System Settings</th>
                    <th className="p-3.5 font-semibold text-center">User Management</th>
                    <th className="p-3.5 font-semibold text-center">Field Entry (PWA)</th>
                    <th className="p-3.5 font-semibold text-center">Ledger & Export</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  <tr className="hover:bg-slate-800/30">
                    <td className="p-3.5 font-semibold text-rose-300">Super Administrator</td>
                    <td className="p-3.5 text-slate-400">Full control over all SHGs, settings, master data, and approvals</td>
                    <td className="p-3.5 text-center"><span className="text-emerald-400 font-bold">✓</span></td>
                    <td className="p-3.5 text-center"><span className="text-emerald-400 font-bold">✓</span></td>
                    <td className="p-3.5 text-center"><span className="text-emerald-400 font-bold">✓</span></td>
                    <td className="p-3.5 text-center"><span className="text-emerald-400 font-bold">✓</span></td>
                    <td className="p-3.5 text-center"><span className="text-emerald-400 font-bold">✓</span></td>
                  </tr>

                  <tr className="hover:bg-slate-800/30">
                    <td className="p-3.5 font-semibold text-amber-300">Regional Admin</td>
                    <td className="p-3.5 text-slate-400">Oversees district/block SHGs, approves weekly loans & savings</td>
                    <td className="p-3.5 text-center"><span className="text-emerald-400 font-bold">✓</span></td>
                    <td className="p-3.5 text-center"><span className="text-rose-500">✕</span></td>
                    <td className="p-3.5 text-center"><span className="text-rose-500">✕</span></td>
                    <td className="p-3.5 text-center"><span className="text-rose-500">✕</span></td>
                    <td className="p-3.5 text-center"><span className="text-emerald-400 font-bold">✓</span></td>
                  </tr>

                  <tr className="hover:bg-slate-800/30">
                    <td className="p-3.5 font-semibold text-indigo-300">Field Operator</td>
                    <td className="p-3.5 text-slate-400">PWA field app operator recording deposits, loans, repayments at meetings</td>
                    <td className="p-3.5 text-center"><span className="text-rose-500">✕</span></td>
                    <td className="p-3.5 text-center"><span className="text-rose-500">✕</span></td>
                    <td className="p-3.5 text-center"><span className="text-rose-500">✕</span></td>
                    <td className="p-3.5 text-center"><span className="text-emerald-400 font-bold">✓</span></td>
                    <td className="p-3.5 text-center"><span className="text-slate-400">Own SHG</span></td>
                  </tr>

                  <tr className="hover:bg-slate-800/30">
                    <td className="p-3.5 font-semibold text-slate-300">Auditor / Viewer</td>
                    <td className="p-3.5 text-slate-400">Read-only transparency passbook and audit reports access</td>
                    <td className="p-3.5 text-center"><span className="text-rose-500">✕</span></td>
                    <td className="p-3.5 text-center"><span className="text-rose-500">✕</span></td>
                    <td className="p-3.5 text-center"><span className="text-rose-500">✕</span></td>
                    <td className="p-3.5 text-center"><span className="text-rose-500">✕</span></td>
                    <td className="p-3.5 text-center"><span className="text-emerald-400 font-bold">✓</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Security & Access Policies */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-5">
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-400" />
              Security & Session Policies
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Allow Viewer Data Export</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Permits users with the "Viewer" role to download ledger CSV and passbook spreadsheets.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formState.allowViewerExport}
                  onChange={(e) => setFormState({ ...formState, allowViewerExport: e.target.checked })}
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer mt-0.5"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Enforce 90-Day Password Expiry</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Requires operators and admins to reset their credentials periodically.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formState.enforcePasswordExpiry}
                  onChange={(e) => setFormState({ ...formState, enforcePasswordExpiry: e.target.checked })}
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer mt-0.5"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Restrict Concurrent Device Logins</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Terminates previous active session when field operator logs in from a new smartphone.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formState.restrictMultipleLogins}
                  onChange={(e) => setFormState({ ...formState, restrictMultipleLogins: e.target.checked })}
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer mt-0.5"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Operator PIN Verification for Approvals</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Requires a secondary 4-digit confirmation before admin rejects or dispatches large loans.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formState.requireTwoFactorForAdmins}
                  onChange={(e) => setFormState({ ...formState, requireTwoFactorForAdmins: e.target.checked })}
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer mt-0.5"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RATE OF INTEREST */}
      {activeTab === 'interest' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Percent className="w-5 h-5 text-indigo-400" />
                Global Interest & Repayment Rules
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Configure baseline interest rates applied across all Self Help Groups during loan creation and repayment.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Monthly Interest Rate (Decimal)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0.005"
                    max="0.10"
                    value={formState.monthlyInterestRate}
                    onChange={(e) => setFormState({ ...formState, monthlyInterestRate: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-200 font-mono text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-indigo-400">
                    {(parseFloat(formState.monthlyInterestRate || '0') * 100).toFixed(1)}% / mo
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Standard NABARD / SHG benchmark: 0.0200 = 2.0% per month (24% per year).
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Repayment Stamp Rate (Decimal)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0.005"
                    max="0.10"
                    value={formState.repaymentStampRate}
                    onChange={(e) => setFormState({ ...formState, repaymentStampRate: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-200 font-mono text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-indigo-400">
                    {(parseFloat(formState.repaymentStampRate || '0') * 100).toFixed(1)}% / mo
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Rate applied to compute interest stamps for repayments.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Grace Period for Overdue Loans (Days)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={formState.gracePeriodDays}
                  onChange={(e) => setFormState({ ...formState, gracePeriodDays: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-400">
                  Days after monthly due date before warning flag appears on PWA dashboard.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Overdue Penalty Surcharge Rate (Decimal)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.00"
                  max="0.05"
                  value={formState.penaltyInterestRate}
                  onChange={(e) => setFormState({ ...formState, penaltyInterestRate: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-200 font-mono text-sm focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-400">
                  Extra penalty charged on delinquent accounts past grace period.
                </p>
              </div>
            </div>
          </div>

          {/* Dynamic Loan Calculation Simulator */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Live Simulation Preview
            </h3>
            <p className="text-xs text-slate-400">
              For a sample loan of <span className="text-slate-200 font-semibold">₹{sampleLoan.toLocaleString('en-IN')}</span>:
            </p>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center text-slate-400">
                <span>Principal Disbursed:</span>
                <span className="text-slate-200 font-bold">₹{sampleLoan.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Monthly Rate:</span>
                <span className="text-indigo-400 font-bold">{(parsedMonthlyRate * 100).toFixed(1)}% / mo</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Annual Equivalent:</span>
                <span className="text-amber-400 font-bold">{annualRatePercent}% p.a.</span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between items-center">
                <span className="text-slate-300">Monthly Interest:</span>
                <span className="text-emerald-400 text-sm font-bold">₹{monthlyIntAmount}/mo</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[11px] flex gap-2">
              <Info className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" />
              <span>
                SHG loan interest is calculated using simple interest on the outstanding balance. Changes saved here will apply to newly disbursed loans.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: VALIDATION RULES */}
      {activeTab === 'validation' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
                Operational & Financial Validation Thresholds
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Configure safety guardrails, max credit ceilings, and meeting stamp limits to protect SHG capital.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Max Loan Amount */}
              <div className="space-y-2 p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
                <label className="block text-xs font-semibold text-slate-200">
                  Maximum Loan Cap (₹)
                </label>
                <input
                  type="number"
                  step="5000"
                  min="10000"
                  max="200000"
                  value={formState.maxLoanAmount}
                  onChange={(e) => setFormState({ ...formState, maxLoanAmount: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-200 font-mono text-sm focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-400">
                  Field app will block operators from issuing loans greater than this limit (e.g. ₹50,000).
                </p>
              </div>

              {/* Default Stamp Value */}
              <div className="space-y-2 p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
                <label className="block text-xs font-semibold text-slate-200">
                  Default Weekly Stamp Value (₹)
                </label>
                <input
                  type="number"
                  step="10"
                  min="10"
                  max="500"
                  value={formState.defaultStampValue}
                  onChange={(e) => setFormState({ ...formState, defaultStampValue: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-200 font-mono text-sm focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-400">
                  Default monetary value assigned to a single meeting savings stamp.
                </p>
              </div>

              {/* Max Stamps Per Meeting */}
              <div className="space-y-2 p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
                <label className="block text-xs font-semibold text-slate-200">
                  Max Stamps Per Member / Meeting
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formState.maxStampsPerMeeting}
                  onChange={(e) => setFormState({ ...formState, maxStampsPerMeeting: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-200 font-mono text-sm focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-400">
                  At ₹{formState.defaultStampValue}/stamp, max deposit allowed is ₹{formState.defaultStampValue * formState.maxStampsPerMeeting} per week.
                </p>
              </div>
            </div>

            {/* Additional Safety Toggles */}
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Approval Workflow & Limits</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200">Mandatory MIS Admin Approval</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      When enabled, all loan disbursements and savings batches recorded in the field remain in "Pending Approval" state until an Admin approves them in the Finance screen.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formState.requireApproval}
                    onChange={(e) => setFormState({ ...formState, requireApproval: e.target.checked })}
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer mt-0.5"
                  />
                </div>

                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200">Max Active Loans Per Member</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Prevents overlapping credit risk. Members must settle their open loan before taking another.
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        value={formState.maxActiveLoansPerMember}
                        onChange={(e) => setFormState({ ...formState, maxActiveLoansPerMember: Number(e.target.value) })}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs"
                      >
                        <option value={1}>1 Active Loan</option>
                        <option value={2}>2 Active Loans</option>
                        <option value={3}>3 Active Loans</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
