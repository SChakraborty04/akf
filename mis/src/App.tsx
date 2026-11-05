import React, { useEffect, useState } from 'react';
import { api } from './api/client';
import type { NavPage } from './components/Sidebar';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { ShgListPage } from './pages/ShgListPage';
import { FinancePage } from './pages/FinancePage';
import { MasterPage } from './pages/MasterPage';
import { SettingsPage } from './pages/SettingsPage';
import type { DashboardKPIs, LocationHierarchy, MISUser, SHGGroup } from './types';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<MISUser | null>(() => api.getUser());
  const [activePage, setActivePage] = useState<NavPage>('home');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('mis_sidebar_collapsed') === 'true';
  });

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('mis_sidebar_collapsed', String(next));
      return next;
    });
  };

  // App-level Shared Data
  const [kpis, setKpis] = useState<DashboardKPIs>({
    totalGroups: 4,
    totalMembers: 48,
    totalActivePortfolio: 185000,
    activeLoansCount: 6,
    totalSavingsCollected: 342000,
    pendingApprovals: {
      totalCount: 5,
      totalAmount: 42500,
      depositsCount: 3,
      loansCount: 2,
    },
  });

  const [districtDistribution, setDistrictDistribution] = useState<{ district: string; groupCount: number }[]>([
    { district: 'Patna', groupCount: 3 },
    { district: 'Nalanda', groupCount: 1 },
  ]);

  const [groups, setGroups] = useState<SHGGroup[]>([]);
  const [locationHierarchy, setLocationHierarchy] = useState<LocationHierarchy>({
    states: ['Bihar'],
    districts: ['Nalanda', 'Patna'],
    blocks: ['Bihar Sharif', 'Danapur', 'Maner', 'Phulwari Sharif'],
    panchayats: ['Haldichhapra', 'Maghra', 'Rampur', 'Saguna'],
    hierarchy: {
      Bihar: {
        Patna: {
          'Phulwari Sharif': ['Rampur'],
          Danapur: ['Saguna'],
          Maner: ['Haldichhapra'],
        },
        Nalanda: {
          'Bihar Sharif': ['Maghra'],
        },
      },
    },
  });

  const loadAllData = async () => {
    setIsRefreshing(true);
    try {
      const [dash, grps, locs] = await Promise.all([
        api.getDashboard(),
        api.getGroups(),
        api.getLocations(),
      ]);

      if (dash?.kpis) setKpis(dash.kpis);
      if (dash?.districtDistribution) setDistrictDistribution(dash.districtDistribution);
      if (grps) setGroups(grps);
      if (locs) setLocationHierarchy(locs);
    } catch (err) {
      console.warn('[MIS App] Network sync error, operating on cached state:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadAllData();
    }
  }, [currentUser]);

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
  };

  const handleNavigate = (page: NavPage) => {
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // If user is not authenticated, display the Admin Login Page
  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          setCurrentUser(user);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 font-sans text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
      {/* Fixed Left Navigation Sidebar */}
      <Sidebar
        activePage={activePage}
        onSelectPage={handleNavigate}
        pendingApprovalsCount={kpis.pendingApprovals.totalCount}
        currentUser={currentUser}
        onLogout={handleLogout}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        <Header
          activePage={activePage}
          onRefresh={loadAllData}
          isRefreshing={isRefreshing}
          pendingCount={kpis.pendingApprovals.totalCount}
          onViewApprovals={() => handleNavigate('finance')}
          currentUser={currentUser}
          onLogout={handleLogout}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
        />

        {/* Page Content Container */}
        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto">
          {activePage === 'home' && (
            <HomePage
              kpis={kpis}
              districtDistribution={districtDistribution}
              onNavigate={handleNavigate}
            />
          )}

          {activePage === 'shg-list' && (
            <ShgListPage
              groups={groups}
              locationHierarchy={locationHierarchy}
              onRefresh={loadAllData}
              onOpenCreateModal={() => handleNavigate('master')}
            />
          )}

          {activePage === 'finance' && (
            <FinancePage
              locationHierarchy={locationHierarchy}
              onRefreshData={loadAllData}
            />
          )}

          {activePage === 'master' && <MasterPage />}

          {activePage === 'settings' && <SettingsPage />}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-900 bg-slate-950/80 px-8 py-4 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>SHG Central MIS Engine v2.4</span>
            <span className="text-slate-700">•</span>
            <span>
              Signed in as: <strong className="text-slate-300 font-semibold">{currentUser.fullName || currentUser.username}</strong> ({currentUser.role})
            </span>
          </div>
          <div>All financial transactions cryptographically signed & immutable</div>
        </footer>
      </div>
    </div>
  );
};

export default App;
