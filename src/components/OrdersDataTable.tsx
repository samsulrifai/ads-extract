import { useState } from 'react';
import { format } from 'date-fns';
import { Download, Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Order } from '@/types';
import { exportToCSV } from '@/lib/export';

interface OrdersDataTableProps {
  orders: Order[];
  loading?: boolean;
}

export default function OrdersDataTable({ orders, loading }: OrdersDataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOrders = orders.filter((order) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      order.order_sn.toLowerCase().includes(term) ||
      order.order_status.toLowerCase().includes(term) ||
      order.payment_method.toLowerCase().includes(term)
    );
  });

  const handleExport = () => {
    if (filteredOrders.length === 0) return;
    
    // Format data for CSV
    const dataForExport = filteredOrders.map((order) => ({
      'Order SN': order.order_sn,
      'Tanggal': format(new Date(order.create_time), 'dd MMM yyyy HH:mm'),
      'Status': order.order_status,
      'Total Jumlah': order.total_amount,
      'Jenis Pembayaran': order.payment_method,
      'Kurir': order.shipping_carrier,
      'Jumlah Item': order.item_count,
    }));

    exportToCSV(dataForExport, `orders-export-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`);
  };

  const getStatusColor = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'COMPLETED') return 'bg-green-500/10 text-green-500 hover:bg-green-500/20';
    if (s === 'CANCELLED') return 'bg-red-500/10 text-red-500 hover:bg-red-500/20';
    if (s === 'READY_TO_SHIP' || s === 'SHIPPED') return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20';
    return 'bg-secondary text-secondary-foreground';
  };

  return (
    <Card className="glass-panel">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          Data Pesanan Khusus
          <Badge variant="secondary" className="ml-2">
            {orders.length}
          </Badge>
        </CardTitle>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari SN, Status, Pembayaran..."
              className="pl-9 w-[250px] bg-background/50 border-white/10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExport}
            disabled={filteredOrders.length === 0 || loading}
            className="border-white/10 hover:bg-white/5"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Order SN</th>
                  <th className="px-4 py-3 font-medium">Waktu</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Pembayaran</th>
                  <th className="px-4 py-3 font-medium text-right">Total Jumlah (Rp)</th>
                  <th className="px-4 py-3 font-medium">Kurir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-4 py-4"><div className="h-4 w-24 bg-white/10 rounded"></div></td>
                      <td className="px-4 py-4"><div className="h-4 w-32 bg-white/10 rounded"></div></td>
                      <td className="px-4 py-4"><div className="h-5 w-20 bg-white/10 rounded-full"></div></td>
                      <td className="px-4 py-4"><div className="h-4 w-20 bg-white/10 rounded"></div></td>
                      <td className="px-4 py-4"><div className="h-4 w-16 bg-white/10 rounded ml-auto"></div></td>
                      <td className="px-4 py-4"><div className="h-4 w-24 bg-white/10 rounded"></div></td>
                    </tr>
                  ))
                ) : filteredOrders.length > 0 ? (
                  filteredOrders.map((order) => (
                    <tr key={order.order_sn} className="hover:bg-white/5 group transition-colors">
                      <td className="px-4 py-3 font-medium">{order.order_sn}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {format(new Date(order.create_time), 'dd MMM yyyy, HH:mm')}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`border-0 ${getStatusColor(order.order_status)}`}>
                          {order.order_status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {order.payment_method}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {order.total_amount.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {order.shipping_carrier}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {searchTerm ? 'Tidak ada pesanan yang sesuai pencarian' : 'Belum ada data pesanan'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
