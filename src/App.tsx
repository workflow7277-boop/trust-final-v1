import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import type { AppPage, SubscriptionSummary, TenantContext } from './lib/types';
import AuthPage from './components/auth/AuthPage';
import Sidebar from './components/dashboard/Sidebar';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import ProductsPage from './pages/ProductsPage';
import StorefrontPage from './pages/StorefrontPage';
import BillingPage from './pages/BillingPage';
import AdminSubscriptionsPage from './pages/AdminSubscriptionsPage';
import { loadTenantContext, syncSubscriptionStatuses } from './lib/subscriptions';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tenantContext, setTenantContext] = useState<TenantContext | null>(null);
  const [currentPage, setCurrentPage] = useState<AppPage>('dashboard');
  const [authChecked, setAuthChecked] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);

  // دالة تحديث بيانات المشترك وحالة الدفع
  const refreshTenantContext = useCallback(async () => {
    if (!user) {
      setTenantContext(null);
      return;
    }
    setContextLoading(true);
    try {
      await syncSubscriptionStatuses();
      const context = await loadTenantContext();
      setTenantContext(context);
    } finally {
      setContextLoading(false);
    }
  }, [user]);

  const handleSummaryChange = useCallback((summary: SubscriptionSummary | null) => {
    setTenantContext((previous) => {
      if (!previous) return previous;
      return { ...previous, subscription_summary: summary };
    });
  }, []);

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
    void refreshTenantContext();
  }, [refreshTenantContext]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-slate-600 text-sm">Loading Trust System...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuthSuccess={() => setCurrentPage('dashboard')} />;
  }

  const profile = tenantContext?.profile ?? null;
  const tenantId = tenantContext?.tenant_id ?? null;
  const subscriptionSummary = tenantContext?.subscription_summary ?? null;
  const isPlatformAdmin = tenantContext?.is_platform_admin ?? false;

  // فحص حالة الاشتراك: هل هو "active"؟
  const isSubscribed = subscriptionSummary?.status === 'active';

  // منع الدخول لصفحات معينة لو مش مشترك
  const renderPage = () => {
    // لو اليوزر بيحاول يدخل على المنتجات أو الإعدادات وهو مش دافع، هوديه لصفحة الـ Billing
    if (!isSubscribed && (currentPage === 'products' || currentPage === 'settings')) {
      return (
        <BillingPage
          tenantId={tenantId}
          userEmail={user.email ?? ''}
          summary={subscriptionSummary}
          onSummaryChange={handleSummaryChange}
        />
      );
    }

    switch (currentPage) {
      case 'dashboard':
        return (
          <DashboardPage
            profile={profile}
            tenantId={tenantId}
            userEmail={user.email ?? ''}
            onNavigate={setCurrentPage}
            subscriptionSummary={subscriptionSummary}
            loading={contextLoading}
          />
        );
      case 'settings':
        return (
          <SettingsPage
            profile={profile}
            tenantId={tenantId}
            userEmail={user.email ?? ''}
            onProfileUpdate={(nextProfile) =>
              setTenantContext((prev) => prev ? { ...prev, profile: nextProfile } : prev)
            }
            subscriptionSummary={subscriptionSummary}
          />
        );
      case 'products':
        return (
          <ProductsPage
            profile={profile}
            tenantId={tenantId}
            userEmail={user.email ?? ''}
            subscriptionSummary={subscriptionSummary}
          />
        );
      case 'billing':
        return (
          <BillingPage
            tenantId={tenantId}
            userEmail={user.email ?? ''}
            summary={subscriptionSummary}
            onSummaryChange={handleSummaryChange}
          />
        );
      case 'admin':
        return <AdminSubscriptionsPage userEmail={user.email ?? ''} enabled={isPlatformAdmin} />;
      case 'storefront':
        return tenantId ? <StorefrontPage subscriberId={tenantId} /> : null;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        storeName={profile?.store_name ?? 'Trust Store'}
        isPlatformAdmin={isPlatformAdmin}
        isSubscribed={isSubscribed} // تمرير حالة الاشتراك للـ Sidebar لو حبيت تعمل علامة قفل
      />
      <main className="flex-1 flex flex-col min-w-0 overflow-auto">
        {renderPage()}
      </main>
    </div>
  );
}