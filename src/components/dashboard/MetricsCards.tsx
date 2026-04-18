import { Users, ShoppingCart, TrendingUp, DollarSign } from 'lucide-react';
import type { Order } from '../../lib/types';

interface MetricsCardsProps {
  orders: Order[];
  currencySymbol: string;
}

export default function MetricsCards({ orders, currencySymbol }: MetricsCardsProps) {
  const totalOrders = orders.length;
  const successOrders = orders.filter((o) => o.status === 'success').length;
  const successRate = totalOrders > 0 ? Math.round((successOrders / totalOrders) * 100) : 0;
  const totalRevenue = orders
    .filter((o) => o.status === 'success')
    .reduce((sum, o) => sum + o.total_price, 0);

  const metrics = [
    {
      label: 'Total Subscribers',
      value: '1',
      icon: Users,
      color: 'blue',
      change: '+0%',
      suffix: '',
    },
    {
      label: 'Total Orders',
      value: totalOrders.toString(),
      icon: ShoppingCart,
      color: 'cyan',
      change: totalOrders > 0 ? '+100%' : '0%',
      suffix: '',
    },
    {
      label: 'Order Success Rate',
      value: successRate.toString(),
      icon: TrendingUp,
      color: 'emerald',
      change: successRate >= 70 ? 'Healthy' : 'Needs attention',
      suffix: '%',
    },
    {
      label: 'Total Revenue',
      value: totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      icon: DollarSign,
      color: 'amber',
      change: totalRevenue > 0 ? 'Active' : 'Awaiting orders',
      suffix: '',
      prefix: currencySymbol,
    },
  ];

  const colorMap: Record<string, { bg: string; border: string; icon: string; badge: string }> = {
    blue: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      icon: 'text-blue-400',
      badge: 'bg-blue-500/10 text-blue-400',
    },
    cyan: {
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/20',
      icon: 'text-cyan-400',
      badge: 'bg-cyan-500/10 text-cyan-400',
    },
    emerald: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      icon: 'text-emerald-400',
      badge: 'bg-emerald-500/10 text-emerald-400',
    },
    amber: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      icon: 'text-amber-400',
      badge: 'bg-amber-500/10 text-amber-400',
    },
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {metrics.map(({ label, value, icon: Icon, color, change, suffix, prefix }) => {
        const c = colorMap[color];
        return (
          <div
            key={label}
            className="bg-[#111827] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 ${c.bg} border ${c.border} rounded-xl flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${c.icon}`} />
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${c.badge}`}>{change}</span>
            </div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
            <p className="text-2xl font-bold text-white tracking-tight">
              {prefix && <span className="text-lg text-slate-400">{prefix}</span>}
              {value}
              {suffix && <span className="text-lg text-slate-400">{suffix}</span>}
            </p>
          </div>
        );
      })}
    </div>
  );
}
