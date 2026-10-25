import React from 'react';
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  Database,
  HandCoins,
  MapPin,
  PlusCircle,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { DashboardKPIs } from '../types';
import type { NavPage } from '../components/Sidebar';

interface HomePageProps {
  kpis: DashboardKPIs;
  districtDistribution: { district: string; groupCount: number }[];
  onNavigate: (page: NavPage) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ kpis, districtDistribution, onNavigate }) => {
  const formatRupees = (val: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Pending Approvals Alert Banner */}
      {kpis.pendingApprovals.totalCount > 0 && (
        <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-400/40 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start md:items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold shrink-0 shadow-sm">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                Action Required: {kpis.pendingApprovals.totalCount} Transactions Pending Approval
              </h2>
              <p className="text-xs text-amber-800 mt-0.5">
                {kpis.pendingApprovals.depositsCount} meeting deposits and {kpis.pendingApprovals.loansCount} loan
                disbursements awaiting verification totaling {formatRupees(kpis.pendingApprovals.totalAmount)}.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('finance')}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 self-start md:self-auto cursor-pointer shadow-sm"
          >
            <span>Review & Approve Now</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total SHGs */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total SHGs</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{kpis.totalGroups}</span>
            <span className="text-xs text-emerald-600 font-medium">Active Groups</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Operating in 2 Districts</span>
            <button
              onClick={() => onNavigate('shg-list')}
              className="text-emerald-700 font-semibold hover:underline flex items-center gap-0.5"
            >
              View All <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Total Members */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Members</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{kpis.totalMembers}</span>
            <span className="text-xs text-blue-600 font-medium">Rural Women</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>100% KYC Verified</span>
            <button
              onClick={() => onNavigate('master')}
              className="text-blue-700 font-semibold hover:underline flex items-center gap-0.5"
            >
              Add Member <PlusCircle className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Active Loan Portfolio */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Loan Portfolio</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {formatRupees(kpis.totalActivePortfolio)}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>{kpis.activeLoansCount} Disbursed Loans</span>
            <span className="text-purple-700 font-semibold">2% Mo. Int.</span>
          </div>
        </div>

        {/* Total Savings Collected */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Savings Collected</span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600 border border-teal-100">
              <HandCoins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {formatRupees(kpis.totalSavingsCollected)}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Passbook Verified</span>
            <button
              onClick={() => onNavigate('finance')}
              className="text-teal-700 font-semibold hover:underline flex items-center gap-0.5"
            >
              Ledger Feed <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Two-Column Middle Section: Regional Breakdown & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* District Hierarchy Distribution */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Regional Footprint & Jurisdiction</h2>
              <p className="text-xs text-slate-500 mt-0.5">SHG saturation by administrative district</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>State: Bihar</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
            {districtDistribution.map((d) => (
              <div
                key={d.district}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-800">{d.district} District</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    {d.groupCount} {d.groupCount === 1 ? 'SHG' : 'SHGs'}
                  </span>
                </div>
                <div className="mt-3 text-xs text-slate-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Target Saturation:</span>
                    <span className="font-semibold text-slate-700">92%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, d.groupCount * 30)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-xl bg-indigo-50/60 border border-indigo-100/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500 text-white font-bold text-xs">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-indigo-950">Administrative Hierarchy Search Enabled</div>
                <div className="text-[11px] text-indigo-800">
                  Filter by State → District → Block → Gram Panchayat in SHG List and Finance pages.
                </div>
              </div>
            </div>
            <button
              onClick={() => onNavigate('shg-list')}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer"
            >
              Open Directory →
            </button>
          </div>
        </div>

        {/* Quick Operations Panel */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Administrator Shortcuts</h2>
            <p className="text-xs text-slate-500 mt-0.5">Quick workflows and data management</p>

            <div className="mt-5 space-y-3">
              <button
                onClick={() => onNavigate('master')}
                className="w-full p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500/50 hover:bg-emerald-50/30 transition-all text-left flex items-center gap-3 group cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Create New SHG</div>
                  <div className="text-[11px] text-slate-500">Provision group with operator username/password</div>
                </div>
              </button>

              <button
                onClick={() => onNavigate('master')}
                className="w-full p-3.5 rounded-xl border border-slate-200 hover:border-blue-500/50 hover:bg-blue-50/30 transition-all text-left flex items-center gap-3 group cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Bulk Excel / CSV Upload</div>
                  <div className="text-[11px] text-slate-500">Import members and households in batches</div>
                </div>
              </button>

              <button
                onClick={() => onNavigate('finance')}
                className="w-full p-3.5 rounded-xl border border-slate-200 hover:border-amber-500/50 hover:bg-amber-50/30 transition-all text-left flex items-center gap-3 group cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-amber-100 text-amber-700 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Approve Meeting Collections</div>
                  <div className="text-[11px] text-slate-500">Verify member stamp breakdown and sign off</div>
                </div>
              </button>

              <button
                onClick={() => onNavigate('settings')}
                className="w-full p-3.5 rounded-xl border border-slate-200 hover:border-purple-500/50 hover:bg-purple-50/30 transition-all text-left flex items-center gap-3 group cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-purple-100 text-purple-700 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Validation Rules & Rates</div>
                  <div className="text-[11px] text-slate-500">Max loan ceiling and simple interest parameters</div>
                </div>
              </button>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              All Services Healthy
            </span>
            <span>Auto-synced</span>
          </div>
        </div>
      </div>
    </div>
  );
};
