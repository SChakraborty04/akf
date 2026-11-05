import React, { useState } from 'react';
import { Shield, MapPin, Users, Calendar, Award, RefreshCw, ChevronRight, User } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useData } from '../context/DataContext';
import { formatDate } from '../utils/formatters';
import MemberDetailModal from '../components/MemberDetailModal';

export default function Profile() {
  const { language, t } = useLanguage();
  const { groupProfile, members, resetData } = useData();

  const [selectedMember, setSelectedMember] = useState(null);

  const handleReset = () => {
    if (window.confirm(t('resetConfirm'))) {
      resetData();
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn pb-8">
      {/* Group Information Card */}
      <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 rounded-3xl p-5 text-white shadow-lg border border-emerald-700/50 space-y-4">
        <div className="flex items-center space-x-3 border-b border-emerald-700/60 pb-3.5">
          <div className="bg-white p-1 rounded-2xl shadow-sm border border-emerald-400/40 w-11 h-11 flex items-center justify-center shrink-0">
            <img src="/logo-transparent.png" alt="AKF Logo" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <h1 className="font-black text-lg text-white tracking-tight">
              {language === 'hi' ? groupProfile.hindiName || groupProfile.name : groupProfile.name}
            </h1>
            <div className="flex items-center space-x-1 text-xs text-emerald-200 mt-0.5 font-medium">
              <MapPin className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span className="truncate">{groupProfile.address}</span>
            </div>
          </div>
        </div>

        {/* Key Group Metrics Grid */}
        <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
          <div className="bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-700/40">
            <span className="block text-[10px] text-emerald-300 uppercase font-semibold">{t('memberCount')}</span>
            <span className="text-sm font-extrabold text-white">{members.length}</span>
          </div>

          <div className="bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-700/40">
            <span className="block text-[10px] text-emerald-300 uppercase font-semibold">{t('stampValue')}</span>
            <span className="text-sm font-extrabold text-white">₹{groupProfile.stampValue || 50}</span>
          </div>

          <div className="bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-700/40">
            <span className="block text-[10px] text-emerald-300 uppercase font-semibold">{t('cycleNo')}</span>
            <span className="text-sm font-extrabold text-white">#{groupProfile.cycleNo || 1}</span>
          </div>
        </div>

        {/* Detailed Info List */}
        <div className="bg-emerald-950/40 p-3 rounded-2xl border border-emerald-700/30 text-xs space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-emerald-300/80 font-medium">{t('cycleStart')}:</span>
            <span className="font-bold text-white">{formatDate(groupProfile.cycleStart, language)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-emerald-300/80 font-medium">{t('cycleEnd')}:</span>
            <span className="font-bold text-white">{formatDate(groupProfile.cycleEnd, language)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-emerald-300/80 font-medium">{t('cycleWeek')}:</span>
            <span className="font-bold text-white">{groupProfile.cycleWeek || 50} weeks</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-emerald-300/80 font-medium">{t('meetingDay')}:</span>
            <span className="font-bold text-emerald-300">{groupProfile.meetingDay || 'Weekly'}</span>
          </div>
        </div>
      </div>

      {/* Members Directory Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-emerald-700" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {t('groupMembers')} ({members.length})
            </h2>
          </div>
          {members.length > 0 && (
            <span className="text-[10px] text-slate-400 font-semibold">Click to view profile</span>
          )}
        </div>

        <div className="space-y-2">
          {members.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-6 text-center space-y-2.5 shadow-xs">
              <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">
                  {t('noMembersTitle')}
                </h3>
                <p className="text-xs text-amber-900/80 mt-1 max-w-xs mx-auto leading-relaxed">
                  {t('noMembersDesc')}
                </p>
              </div>
            </div>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                onClick={() => setSelectedMember(member)}
                className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all active:scale-98"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-800 font-black text-sm rounded-2xl flex items-center justify-center border border-emerald-200">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-slate-900">
                      {member.name}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {member.husbandName} • <span className="font-mono text-emerald-700 font-bold">{member.hhNo}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-slate-400">
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                    {member.mobileNo?.slice(-4) || '----'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sync Data from Server Button */}
      <div className="pt-2">
        <button
          onClick={handleReset}
          className="w-full flex items-center justify-center space-x-2 py-3 bg-slate-200 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 font-bold text-xs rounded-2xl transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>{t('resetDataBtn')}</span>
        </button>
      </div>

      {/* Member Detail Modal */}
      <MemberDetailModal
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
      />
    </div>
  );
}
