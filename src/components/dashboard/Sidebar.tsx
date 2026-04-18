import { LayoutDashboard, Settings, Package, Globe, LogOut, ShieldCheck, ChevronRight, CreditCard, Shield } from 'lucide-react';
import type { AppPage } from '../../lib/types';
import { supabase } from '../../lib/supabase';

interface SidebarProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  storeName: string;
  isPlatformAdmin: boolean;
}

const navItems = [
  { id: 'dashboard' as AppPage, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'products' as AppPage, label: 'Products', icon: Package },
  { id: 'settings' as AppPage, label: 'Store Settings', icon: Settings },
  { id: 'billing' as AppPage, label: 'Billing', icon: CreditCard },
  { id: 'storefront' as AppPage, label: 'Storefront Preview', icon: Globe },
];

export default function Sidebar({ currentPage, onNavigate, storeName, isPlatformAdmin }: SidebarProps) {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <aside className="w-64 bg-[#0d1425] border-r border-white/5 flex flex-col min-h-screen">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">Trust</p>
            <p className="text-sm font-semibold text-white truncate">{storeName}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
              currentPage === id
                ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            {currentPage === id && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
          </button>
        ))}

        {isPlatformAdmin && (
          <button
            onClick={() => onNavigate('admin')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
              currentPage === 'admin'
                ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Shield className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">Admin Subscriptions</span>
            {currentPage === 'admin' && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
          </button>
        )}
      </nav>

      <div className="p-4 border-t border-white/5">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
