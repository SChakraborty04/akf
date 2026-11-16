import React, { useState, useMemo } from 'react';
import { Users, RefreshCw, ChevronRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/formatters';
import MemberDetailModal from '../components/MemberDetailModal';
import LoadingButton from '../components/LoadingButton';

export default function Profile() {
  const { t } = useLanguage();
  const { members = [], deposits = [], resetData } = useData();
  const toast = useToast();

  const [selectedMember, setSelectedMember] = useState(null);

  // Pre-compute savings balance per member
  const memberBalanceMap = useMemo(() => {
    const map = new Map();
    for (const dep of deposits) {
      if (Array.isArray(dep.memberDeposits)) {
        for (const md of dep.memberDeposits) {
          const prev = map.get(md.memberId) || 0;
          map.set(md.memberId, prev + Number(md.amount || 0));
        }
      }
    }
    return map;
  }, [deposits]);

  const handleReset = async () => {
    if (!window.confirm(t('resetConfirm'))) {
      toast.info(t('syncCancelled'));
      return;
    }

    const result = await resetData();
    if (result?.success === false) {
      toast.error(result.error || t('syncFailed'));
      return;
    }
    toast.success(t('syncSuccess'));
  };

  return (
    <div className="space-y-4 animate-fadeIn pb-8">
      {/* Header Banner */}
      <div className="bg-emerald-800 text-white p-4 rounded-2xl shadow-sm flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-extrabold text-base truncate">{t('navMembers')}</h1>
          <p className="text-xs text-emerald-200 mt-0.5 truncate">{t('membersSubtitle')}</p>
        </div>
        <div className="bg-emerald-700 p-2.5 rounded-xl text-emerald-200 shrink-0">
          <Users className="w-6 h-6" />
        </div>
      </div>

      {/* Members Directory Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1 gap-2">
          <div className="flex items-center space-x-2 min-w-0">
            <Users className="w-4 h-4 text-emerald-700 shrink-0" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider truncate">
              {t('groupMembers')} ({members.length})
            </h2>
          </div>
          {members.length > 0 && (
            <span className="text-[10px] text-slate-400 font-semibold shrink-0">
              Tap for weekly details
            </span>
          )}
        </div>

        <div className="space-y-2">
          {members.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-6 text-center space-y-2.5 shadow-xs">
              <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">{t('noMembersTitle')}</h3>
                <p className="text-xs text-amber-900/80 mt-1 max-w-xs mx-auto leading-relaxed">
                  {t('noMembersDesc')}
                </p>
              </div>
            </div>
          ) : (
            members.map((member) => {
              const memberBalance = memberBalanceMap.get(member.id) || 0;
              return (
                <div
                  key={member.id}
                  onClick={() => setSelectedMember(member)}
                  className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-2 cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all active:scale-98"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-800 font-black text-sm rounded-2xl flex items-center justify-center border border-emerald-200 shrink-0">
                      {member.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-extrabold text-slate-900 truncate">
                        {member.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                        {member.husbandName} •{' '}
                        <span className="font-mono text-emerald-700 font-bold">{member.hhNo}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <div className="bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-xl text-right">
                      <span className="block text-[9px] uppercase font-bold text-emerald-700 leading-none">
                        {t('balanceLabel')}
                      </span>
                      <span className="text-xs font-black text-emerald-900 leading-tight">
                        {formatCurrency(memberBalance)}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Sync Data from Server Button */}
      <div className="pt-2">
        <LoadingButton
          onClick={handleReset}
          loadingText={t('processing')}
          className="w-full flex items-center justify-center space-x-2 py-3 bg-slate-200 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 font-bold text-xs rounded-2xl transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>{t('resetDataBtn')}</span>
        </LoadingButton>
      </div>

      {/* Member Detail Modal */}
      <MemberDetailModal member={selectedMember} onClose={() => setSelectedMember(null)} />
    </div>
  );
}
