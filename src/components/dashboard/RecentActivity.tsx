import { Clock, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { Order } from '../../lib/types';

interface RecentActivityProps {
  orders: Order[];
  loading: boolean;
}

const StatusBadge = ({ status }: { status: Order['status'] }) => {
  const map = {
    pending: { icon: Clock, label: 'Pending', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    processing: { icon: Loader2, label: 'Processing', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    success: { icon: CheckCircle, label: 'Success', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    failed: { icon: XCircle, label: 'Failed', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  };

  const { icon: Icon, label, className } = map[status] || map.pending;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${className}`}>
      <Icon className={`w-3 h-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {label}
    </span>
  );
};

export default function RecentActivity({ orders, loading }: RecentActivityProps) {
  const recentOrders = orders.slice(0, 10);

  return (
    <div className="bg-[#111827] border border-white/5 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Recent Orders</h2>
          <p className="text-xs text-slate-500 mt-0.5">Latest activity across your store</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-xs text-slate-500">Live</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="w-10 h-10 text-slate-700 mb-3" />
            <p className="text-slate-500 text-sm font-medium">No orders yet</p>
            <p className="text-slate-600 text-xs mt-1">Orders will appear here once customers start buying</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Order</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Customer</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Product</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-xs font-mono text-slate-500">#{order.id.slice(0, 8)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-white">{order.customer_name}</p>
                      <p className="text-xs text-slate-500">{order.customer_phone}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-300 max-w-32 truncate">{order.product_name}</p>
                    <p className="text-xs text-slate-500">Qty: {order.quantity}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold text-emerald-400">
                      ${order.total_price.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-slate-500">
                      {new Date(order.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
