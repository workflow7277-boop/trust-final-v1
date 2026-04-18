import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import type { AppPage, SubscriberProfile } from './lib/types';
import AuthPage from './components/auth/AuthPage';
import Sidebar from './components/dashboard/Sidebar';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import ProductsPage from './pages/ProductsPage';
import StorefrontPage from './pages/StorefrontPage';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SubscriberProfile | null>(null);
  const [currentPage, setCurrentPage] = useState<AppPage>('dashboard');
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setProfile(null); return; }

    const loadProfile = async () => {
      const { data } = await supabase
        .from('subscriber_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      setProfile(data);
    };

    loadProfile();
  }, [user]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-slate-600 text-sm">Loading Trust...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuthSuccess={() => setCurrentPage('dashboard')} />;
  }

  if (currentPage === 'storefront') {
    return (
      <div className="relative">
        <button
          onClick={() => setCurrentPage('dashboard')}
          className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-xs font-semibold px-3 py-2 rounded-xl border border-white/10 hover:bg-gray-800 transition-all shadow-lg"
        >
          Back to Dashboard
        </button>
        <StorefrontPage subscriberId={user.id} />
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <DashboardPage
            profile={profile}
            userId={user.id}
            userEmail={user.email ?? ''}
            onNavigate={setCurrentPage}
          />
        );
      case 'settings':
        return (
          <SettingsPage
            profile={profile}
            userId={user.id}
            userEmail={user.email ?? ''}
            onProfileUpdate={setProfile}
          />
        );
      case 'products':
        return (
          <ProductsPage
            profile={profile}
            userId={user.id}
            userEmail={user.email ?? ''}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        storeName={profile?.store_name ?? 'My Store'}
      />
      <main className="flex-1 flex flex-col min-w-0 overflow-auto">
        {renderPage()}
      </main>
    </div>
  );
}
