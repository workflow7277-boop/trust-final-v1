import { Bell, Search, User } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  userEmail: string;
}

export default function Header({ title, subtitle, userEmail }: HeaderProps) {
  return (
    <header className="h-16 bg-[#0d1425]/80 backdrop-blur border-b border-white/5 flex items-center justify-between px-6 sticky top-0 z-10">
      <div>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            placeholder="Search..."
            className="bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/40 w-48 transition-all focus:w-64"
          />
        </div>

        <button className="relative w-9 h-9 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-400 rounded-full" />
        </button>

        <div className="flex items-center gap-2.5 pl-4 border-l border-white/10">
          <div className="w-8 h-8 bg-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center">
            <User className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-sm text-slate-400 hidden md:block truncate max-w-32">{userEmail}</span>
        </div>
      </div>
    </header>
  );
}
